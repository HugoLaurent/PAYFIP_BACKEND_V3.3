import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import type Invoice from '#models/invoice'
import { sendMail } from '#services/svc_mail_client'
import FailedInvoiceMail from '#models/failed_invoice_mail'

export async function sendInvoiceConfirmationEmail(invoice: Invoice): Promise<void> {
  if (!invoice.payerEmail) {
    return
  }

  try {
    await sendMail({
      template: 'invoice_confirmation',
      to: invoice.payerEmail,
      data: {
        confirmation: invoice.paymentReference ?? String(invoice.id),
        objectLabel: invoice.objectLabel,
        amountCents: invoice.amountCents,
        clientNumber: invoice.clientNumber ?? undefined,
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
    await FailedInvoiceMail.updateOrCreate(
      { invoiceId: invoice.id },
      { attempts, nextRetryAt: DateTime.now().plus({ minutes: 2 ** attempts }) }
    )
  }
}
