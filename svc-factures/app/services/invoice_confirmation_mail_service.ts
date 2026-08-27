import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import type Invoice from '#models/invoice'
import { sendMail } from '#services/svc_mail_client'
import { fetchServiceIdentity } from '#services/svc_auth_client'
import FailedInvoiceMail from '#models/failed_invoice_mail'
import { notifyOpsAlert } from '#services/ops_alert_service'

// Au-delà de ce délai depuis la première tentative, on arrête de rejouer
// et on alerte plutôt que d'échouer indéfiniment en silence.
const MAX_RETRY_AGE_HOURS = 24

export async function sendInvoiceConfirmationEmail(invoice: Invoice): Promise<void> {
  if (!invoice.payerEmail) {
    return
  }

  // serviceId peut être nul (dépôt non rattaché à un service précis) —
  // l'email dégrade alors vers un en-tête générique, jamais une erreur.
  const identity = invoice.serviceId
    ? await fetchServiceIdentity(String(invoice.orgId), invoice.serviceId)
    : null

  try {
    await sendMail({
      template: 'invoice_confirmation',
      to: invoice.payerEmail,
      data: {
        confirmation: invoice.paymentReference ?? String(invoice.id),
        objectLabel: invoice.objectLabel,
        amountCents: invoice.amountCents,
        clientNumber: invoice.clientNumber ?? undefined,
        serviceName: identity?.name,
        orgName: identity?.orgName ?? undefined,
        logoUrl: identity?.hasLogo
          ? `${env.get('PAYFIP_PUBLIC_BASE_URL')}/services/${invoice.serviceId}/logo`
          : undefined,
      },
    })

    // Un succès après un ou plusieurs échecs : plus rien à rejouer.
    await FailedInvoiceMail.query().where('invoiceId', invoice.id).delete()
  } catch (error) {
    logger.warn({ invoiceId: invoice.id, error }, "invoice_confirmation_mail: échec d'envoi")

    // svc-mail lui-même injoignable (pas juste un échec SMTP) : rien
    // n'existe côté svc-mail pour que son propre cron le rejoue. On
    // enregistre l'intention ici, chez l'appelant, pour que
    // node ace invoice-mails:retry puisse reprendre plus tard.
    const existing = await FailedInvoiceMail.findBy('invoiceId', invoice.id)
    const attempts = (existing?.attempts ?? 0) + 1
    const firstFailedAt = existing?.createdAt ?? DateTime.now()
    const ageHours = DateTime.now().diff(firstFailedAt, 'hours').hours

    if (ageHours >= MAX_RETRY_AGE_HOURS) {
      await FailedInvoiceMail.query().where('invoiceId', invoice.id).delete()
      await notifyOpsAlert(
        'Email de confirmation facture abandonné après 24h',
        `Facture #${invoice.id} (${invoice.payerEmail}) : ${attempts} tentatives échouées sur ${MAX_RETRY_AGE_HOURS}h, abandon.`
      )
    } else {
      await FailedInvoiceMail.updateOrCreate(
        { invoiceId: invoice.id },
        { attempts, nextRetryAt: DateTime.now().plus({ minutes: 2 ** attempts }) }
      )
    }
  }
}
