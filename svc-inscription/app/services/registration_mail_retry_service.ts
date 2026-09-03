import { DateTime } from 'luxon'
import Registration from '#models/registration'
import Event from '#models/event'
import FailedRegistrationMail from '#models/failed_registration_mail'
import {
  sendRegistrationConfirmationEmail,
  sendPaymentRequestEmail,
  sendRegistrationRejectionEmail,
  sendWaitlistOfferEmail,
} from '#services/registration_mail_service'
import { refreshTenantRegistry } from '#services/tenant_registry_client'
import { runOnAllTenants } from '#services/tenant_connection_service'

/**
 * Appelé par la commande ace `registration-mails:retry`, qui ne tourne
 * jamais assez longtemps pour bénéficier du rafraîchissement périodique
 * de l'annuaire (réservé au serveur HTTP) : rechargement explicite avant
 * le fan-out.
 */
export async function retryFailedRegistrationMails(): Promise<number> {
  await refreshTenantRegistry()

  const counts = await runOnAllTenants(async () => {
    const due = await FailedRegistrationMail.query().where(
      'nextRetryAt',
      '<=',
      DateTime.now().toJSDate()
    )

    for (const failure of due) {
      const registration = await Registration.find(failure.registrationId)
      if (!registration) continue
      const event = await Event.find(registration.eventId)
      if (!event) continue

      // Chaque fonction gère elle-même le succès (supprime la ligne) et
      // l'échec (met à jour attempts/nextRetryAt) — un seul point de vérité
      // pour cette logique, qu'on soit au premier essai ou ici.
      switch (failure.mailKind) {
        case 'confirmation':
          await sendRegistrationConfirmationEmail(registration, event)
          break
        case 'payment_request':
          await sendPaymentRequestEmail(registration, event)
          break
        case 'rejection':
          await sendRegistrationRejectionEmail(registration, event)
          break
        case 'waitlist_offer':
          await sendWaitlistOfferEmail(registration, event)
          break
      }
    }

    return due.length
  })

  return counts.reduce((total, count) => total + count, 0)
}
