import { DateTime } from 'luxon'
import Event from '#models/event'
import Registration from '#models/registration'

// Statuts qui tiennent réellement une place pour un évènement — voir
// plan §1 "Calcul de capacité". `waitlisted` n'y est PAS inclus par
// défaut : une inscription en liste d'attente ne réserve la place que
// pendant la fenêtre d'offre active (waitlistResponseDeadline non
// expirée), traité séparément ci-dessous pour éviter de proposer la même
// place à deux personnes en même temps.
const SEAT_HOLDING_STATUSES = ['awaiting_review', 'awaiting_payment', 'confirmed'] as const

export interface CapacityCheck {
  fits: boolean
  // Position dans la file d'attente si fits === false (count des
  // `waitlisted` existants + 1) — undefined si fits === true.
  waitlistPosition?: number
}

/**
 * Places prises pour un évènement = somme de `quantity` sur les
 * inscriptions dans un statut qui tient une place, plus les `waitlisted`
 * dont l'offre de liste d'attente est encore active (48h, voir
 * waitlist_service.ts) — une offre non expirée réserve provisoirement la
 * place pour éviter de la proposer deux fois.
 */
export async function computeSeatsHeld(eventId: number): Promise<number> {
  const heldRows = await Registration.query()
    .where('eventId', eventId)
    .whereIn('status', [...SEAT_HOLDING_STATUSES])
    .sum('quantity as total')

  const activeOfferRows = await Registration.query()
    .where('eventId', eventId)
    .where('status', 'waitlisted')
    .whereNotNull('waitlistResponseDeadline')
    .where('waitlistResponseDeadline', '>', DateTime.now().toSQL()!)
    .sum('quantity as total')

  const held = Number(heldRows[0]?.$extras.total ?? 0)
  const activeOffers = Number(activeOfferRows[0]?.$extras.total ?? 0)
  return held + activeOffers
}

/**
 * Détermine si une nouvelle inscription de `quantity` places tient dans
 * l'évènement, ou doit être mise en liste d'attente — jamais refusée
 * (voir plan §0bis point 1 et parcours D). `capacity === null` signifie
 * illimité : toujours `fits: true`.
 */
export async function checkCapacity(event: Event, quantity: number): Promise<CapacityCheck> {
  if (event.capacity === null) {
    return { fits: true }
  }

  const seatsHeld = await computeSeatsHeld(event.id)
  if (seatsHeld + quantity <= event.capacity) {
    return { fits: true }
  }

  const waitlistCount = await Registration.query()
    .where('eventId', event.id)
    .where('status', 'waitlisted')
    .count('* as total')

  return { fits: false, waitlistPosition: Number(waitlistCount[0].$extras.total) + 1 }
}
