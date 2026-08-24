import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import type Order from '#models/order'
import type Ticket from '#models/ticket'
import { sendMail } from '#services/svc_mail_client'
import { fetchServiceStatus } from '#services/svc_auth_client'
import { generateOrderTicketsPdf } from '#services/ticket_pdf_service'
import FailedTicketMail from '#models/failed_ticket_mail'

export async function sendTicketConfirmationEmail(order: Order, tickets: Ticket[]): Promise<void> {
  const countByType = new Map<string, number>()
  for (const ticket of tickets) {
    countByType.set(ticket.tariffType, (countByType.get(ticket.tariffType) ?? 0) + 1)
  }
  const billetsSummary = [...countByType.entries()]
    .map(([type, count]) => `${count} x ${type}`)
    .join(', ')

  // Dégrade vers un en-tête générique si svc-auth ne répond pas — jamais
  // une erreur d'envoi pour un habillage visuel.
  const identity = await fetchServiceStatus(order.orgId, order.serviceId).catch(() => null)

  try {
    const attachments = [
      {
        filename: `billets-${order.paymentReference ?? order.id}.pdf`,
        contentBase64: (await generateOrderTicketsPdf(tickets, order)).toString('base64'),
        contentType: 'application/pdf',
      },
    ]

    await sendMail({
      template: 'ticket_confirmation',
      to: order.email,
      data: {
        email: order.email,
        confirmation: order.paymentReference ?? String(order.id),
        visitDate: order.visitDate.toFormat('dd/MM/yyyy'),
        billetsSummary,
        totalAmountCents: order.totalAmountCents,
        serviceName: identity?.name,
        orgName: identity?.orgName ?? undefined,
        logoUrl: identity?.hasLogo
          ? `${env.get('PAYFIP_PUBLIC_BASE_URL')}/services/${order.serviceId}/logo`
          : undefined,
      },
      attachments,
    })

    // Un succès après un ou plusieurs échecs : plus rien à rejouer.
    await FailedTicketMail.query().where('orderId', order.id).delete()
  } catch (error) {
    logger.warn({ orderId: order.id, error }, "ticket_confirmation_mail: échec d'envoi")

    // svc-mail lui-même injoignable (pas juste un échec SMTP) : rien
    // n'existe côté svc-mail pour que son propre cron le rejoue. On
    // enregistre l'intention ici, chez l'appelant, pour que
    // node ace ticket-mails:retry puisse reprendre plus tard.
    const existing = await FailedTicketMail.findBy('orderId', order.id)
    const attempts = (existing?.attempts ?? 0) + 1
    await FailedTicketMail.updateOrCreate(
      { orderId: order.id },
      { attempts, nextRetryAt: DateTime.now().plus({ minutes: 2 ** attempts }) }
    )
  }
}
