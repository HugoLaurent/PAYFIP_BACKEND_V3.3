import { DateTime } from 'luxon'
import Event from '#models/event'
import Registration from '#models/registration'
import { sendWaitlistOfferEmail } from '#services/registration_mail_service'

// Délai laissé à la personne notifiée pour confirmer avant que l'offre
// passe à la suivante (maquette, plan §0bis point 1).
const WAITLIST_RESPONSE_HOURS = 48

/**
 * À appeler après toute libération de place (annulation citoyenne,
 * expiration de paiement, expiration de re-dépôt de justificatifs, ou
 * expiration d'une précédente offre de liste d'attente non honorée) :
 * notifie la personne en tête de file qui n'a pas encore reçu d'offre.
 *
 * Ne fait rien si personne n'attend, ou si la prochaine personne en liste
 * a déjà une offre active/expirée en cours de traitement ailleurs
 * (`waitlistNotifiedAt` déjà renseigné) — c'est alors à
 * process_registration_expirations de faire expirer cette offre avant
 * qu'on puisse en proposer une nouvelle.
 */
export async function promoteNextWaitlisted(eventId: number): Promise<Registration | null> {
  const next = await Registration.query()
    .where('eventId', eventId)
    .where('status', 'waitlisted')
    .whereNull('waitlistNotifiedAt')
    .orderBy('waitlistPosition', 'asc')
    .first()

  if (!next) return null

  const event = await Event.find(eventId)
  if (!event) return null

  next.waitlistNotifiedAt = DateTime.now()
  next.waitlistResponseDeadline = DateTime.now().plus({ hours: WAITLIST_RESPONSE_HOURS })
  await next.save()

  await sendWaitlistOfferEmail(next, event)

  return next
}
