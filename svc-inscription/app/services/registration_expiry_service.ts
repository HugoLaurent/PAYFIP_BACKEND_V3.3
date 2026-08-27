import { DateTime } from 'luxon'
import Registration from '#models/registration'
import { promoteNextWaitlisted } from '#services/waitlist_service'

// Une session de paiement PayFiP expire elle-même après ~15 min (voir le
// commentaire équivalent dans svc-billetterie/app/services/svc_gestion_client.ts
// sur retryPaymentRequest) — on laisse une marge avant de considérer
// l'inscription elle-même abandonnée, pour ne pas couper une tentative de
// paiement encore en cours côté citoyen (retry-payment reste possible
// jusqu'à cette échéance).
const AWAITING_PAYMENT_EXPIRY_MINUTES = 30

export interface ExpirySweepResult {
  expiredAwaitingPayment: number
  cancelledUnresolvedRejections: number
  expiredWaitlistOffers: number
}

/**
 * Balaie les inscriptions bloquées dans un état transitoire dépassé et les
 * fait transiter vers un état terminal, en libérant la place à chaque fois
 * (voir plan §2 "Nouvelle commande planifiée") :
 *  - `awaiting_payment` sans résolution depuis trop longtemps → `expired`
 *  - `rejected` sans re-dépôt avant `documentDeadlineAt` → `cancelled`
 *  - `waitlisted` notifiée dont le délai de confirmation est dépassé → `expired`
 * Chaque libération de place déclenche promoteNextWaitlisted pour l'évènement
 * concerné, qui ne fait rien si personne n'attend.
 */
export async function processRegistrationExpirations(): Promise<ExpirySweepResult> {
  const now = DateTime.now()
  const result: ExpirySweepResult = {
    expiredAwaitingPayment: 0,
    cancelledUnresolvedRejections: 0,
    expiredWaitlistOffers: 0,
  }

  const staleAwaitingPayment = await Registration.query()
    .where('status', 'awaiting_payment')
    .where('updatedAt', '<', now.minus({ minutes: AWAITING_PAYMENT_EXPIRY_MINUTES }).toSQL()!)

  for (const registration of staleAwaitingPayment) {
    registration.status = 'expired'
    await registration.save()
    result.expiredAwaitingPayment += 1
    await promoteNextWaitlisted(registration.eventId)
  }

  const overdueRejections = await Registration.query()
    .where('status', 'rejected')
    .whereNotNull('documentDeadlineAt')
    .where('documentDeadlineAt', '<', now.toSQL()!)

  for (const registration of overdueRejections) {
    registration.status = 'cancelled'
    registration.cancelledAt = now
    await registration.save()
    result.cancelledUnresolvedRejections += 1
    await promoteNextWaitlisted(registration.eventId)
  }

  const overdueWaitlistOffers = await Registration.query()
    .where('status', 'waitlisted')
    .whereNotNull('waitlistNotifiedAt')
    .whereNotNull('waitlistResponseDeadline')
    .where('waitlistResponseDeadline', '<', now.toSQL()!)

  for (const registration of overdueWaitlistOffers) {
    registration.status = 'expired'
    await registration.save()
    result.expiredWaitlistOffers += 1
    await promoteNextWaitlisted(registration.eventId)
  }

  return result
}
