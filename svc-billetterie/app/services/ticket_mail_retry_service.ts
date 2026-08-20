import { DateTime } from 'luxon'
import Order from '#models/order'
import FailedTicketMail from '#models/failed_ticket_mail'
import { sendTicketConfirmationEmail } from '#services/ticket_confirmation_mail_service'

export async function retryFailedTicketMails(): Promise<number> {
  const due = await FailedTicketMail.query().where('nextRetryAt', '<=', DateTime.now().toJSDate())

  for (const failure of due) {
    const order = await Order.query().where('id', failure.orderId).preload('tickets').first()
    if (!order) continue

    // sendTicketConfirmationEmail gère elle-même le succès (supprime la
    // ligne) et l'échec (met à jour attempts/nextRetryAt) — un seul point
    // de vérité pour cette logique, qu'on soit au premier essai ou ici.
    await sendTicketConfirmationEmail(order, order.tickets)
  }

  return due.length
}
