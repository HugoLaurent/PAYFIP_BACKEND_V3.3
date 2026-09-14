import logger from '@adonisjs/core/services/logger'
import { retryFailedDeliveries } from '#services/webhook_dispatcher_service'

// La commande ace `webhooks:retry` existe toujours ici (svc-gestion n'a
// pas été touché par le bug ace/FsLoader rencontré sur billetterie/
// factures/inscription, voir a229064/0c18deb), mais rien ne l'a jamais
// déclenchée automatiquement : Ofelia, censé le faire, n'a en réalité
// jamais été appliqué sur le vrai fichier de déploiement du VPS. Même
// remède que les 3 autres services : un setInterval en process, au boot
// du serveur HTTP, en plus de la commande ace (gardée pour un
// déclenchement manuel/ops).
const FIVE_MINUTES = 5 * 60_000

setInterval(() => {
  retryFailedDeliveries()
    .then((count) => {
      if (count > 0) logger.info(`[scheduler] webhooks:retry : ${count} livraison(s) retentée(s)`)
    })
    .catch((error) => logger.error({ err: error }, '[scheduler] échec de webhooks:retry'))
}, FIVE_MINUTES).unref()
