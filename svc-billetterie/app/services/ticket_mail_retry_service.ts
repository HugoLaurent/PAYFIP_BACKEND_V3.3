import { DateTime } from 'luxon'
import Order from '#models/order'
import FailedTicketMail from '#models/failed_ticket_mail'
import { sendTicketConfirmationEmail } from '#services/ticket_confirmation_mail_service'
import { refreshTenantRegistry } from '#services/tenant_registry_client'
import { runOnAllTenants } from '#services/tenant_connection_service'

/**
 * Appelé par la commande ace `ticket-mails:retry`, qui ne tourne jamais
 * assez longtemps pour bénéficier du rafraîchissement périodique de
 * l'annuaire (réservé au serveur HTTP) : rechargement explicite avant le
 * fan-out.
 */
export async function retryFailedTicketMails(): Promise<number> {
  await refreshTenantRegistry()

  const counts = await runOnAllTenants(async () => {
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
  })

  return counts.reduce((total, count) => total + count, 0)
}
