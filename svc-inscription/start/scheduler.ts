import logger from '@adonisjs/core/services/logger'
import { expireStalePaymentAttempts } from '#services/payment_attempt_expiry_service'
import { retryFailedRegistrationMails } from '#services/registration_mail_retry_service'
import { processRegistrationExpirations } from '#services/registration_expiry_service'

// Remplace les commandes ace `payment-attempts:expire`, `registration-mails:retry`
// et `registrations:process-expirations` (supprimées, voir a229064/0c18deb) :
// un bug ace/FsLoader jamais élucidé bloque toute commande projet dès qu'un
// fichier voisin de commands/ est invalide — non reproductible en local,
// mais bloquant sur le VPS de démo. On tourne donc en process, au boot du
// serveur HTTP, sans jamais passer par le kernel ace.
const FIVE_MINUTES = 5 * 60_000

function runPeriodically(label: string, task: () => Promise<number>): void {
  setInterval(() => {
    task()
      .then((count) => {
        if (count > 0) logger.info(`[scheduler] ${label} : ${count} traitement(s)`)
      })
      .catch((error) => logger.error({ err: error }, `[scheduler] échec de ${label}`))
  }, FIVE_MINUTES).unref()
}

runPeriodically('payment-attempts:expire', expireStalePaymentAttempts)
runPeriodically('registration-mails:retry', retryFailedRegistrationMails)

setInterval(() => {
  processRegistrationExpirations()
    .then((result) => {
      const total =
        result.expiredAwaitingPayment +
        result.cancelledUnresolvedRejections +
        result.expiredWaitlistOffers
      if (total > 0) {
        logger.info(
          `[scheduler] registrations:process-expirations : ` +
            `${result.expiredAwaitingPayment} paiement(s) expiré(s), ` +
            `${result.cancelledUnresolvedRejections} rejet(s) annulé(s) faute de re-dépôt, ` +
            `${result.expiredWaitlistOffers} offre(s) de liste d'attente expirée(s)`
        )
      }
    })
    .catch((error) =>
      logger.error({ err: error }, '[scheduler] échec de registrations:process-expirations')
    )
}, FIVE_MINUTES).unref()
