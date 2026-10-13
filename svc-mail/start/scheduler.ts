import logger from '@adonisjs/core/services/logger'
import { purgeOldEmailDeliveries } from '#services/data_retention_service'

// Rétention du journal des envois (voir data_retention_service.ts) : une fois
// par jour, première passe peu après le démarrage. Les relances d'emails en
// échec restent pilotées par la commande `emails:retry` (inchangée).
// RETENTION_FIRST_RUN_DELAY_MS n'existe que pour pouvoir tester la purge sans
// attendre.
const ONE_DAY = 24 * 60 * 60_000
const FIRST_RUN_DELAY_MS = Number(process.env.RETENTION_FIRST_RUN_DELAY_MS ?? 10 * 60_000)

function run() {
  purgeOldEmailDeliveries()
    .then((count) => logger.info(`[scheduler] retention:email-deliveries : ${count} suppression(s)`))
    .catch((error) => logger.error({ err: error }, '[scheduler] échec de retention:email-deliveries'))
}

setTimeout(run, FIRST_RUN_DELAY_MS).unref()
setInterval(run, ONE_DAY).unref()
