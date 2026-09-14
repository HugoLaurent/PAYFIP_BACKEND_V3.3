import logger from '@adonisjs/core/services/logger'
import { expireStalePaymentAttempts } from '#services/payment_attempt_expiry_service'
import { retryFailedInvoiceMails } from '#services/invoice_mail_retry_service'

// Remplace les commandes ace `payment-attempts:expire` et `invoice-mails:retry`
// (supprimées, voir a229064/0c18deb) : un bug ace/FsLoader jamais élucidé
// bloque toute commande projet dès qu'un fichier voisin de commands/ est
// invalide — non reproductible en local, mais bloquant sur le VPS de démo.
// On tourne donc en process, au boot du serveur HTTP, sans jamais passer
// par le kernel ace.
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
runPeriodically('invoice-mails:retry', retryFailedInvoiceMails)
