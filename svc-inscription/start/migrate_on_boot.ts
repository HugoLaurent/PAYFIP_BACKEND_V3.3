import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import { refreshTenantRegistry } from '#services/tenant_registry_client'
import { runOnAllTenants, connectionNameFor } from '#services/tenant_connection_service'
import { migrateTenantConnection } from '#services/tenant_migration_service'
import { notifyOpsAlert } from '#services/ops_alert_service'

// Remplace la commande ace `tenant:migrate`, qui n'était jamais appelée
// automatiquement (aucune étape de migration dans deploy.yml — un humain
// devait s'en souvenir après chaque déploiement) et dont l'échec ne faisait
// jamais échouer le process (aucun exitCode positionné, juste un log).
// Migre chaque base tenant au boot du serveur — donc à chaque déploiement
// qui recrée ce conteneur — et alerte (Teams) si une base échoue, plutôt
// que de compter sur quelqu'un qui grep les logs.
//
// Ne bloque jamais le démarrage du serveur (même logique que
// tenant_registry.ts) : une migration en cours ne doit pas retarder le
// health check. Ne ferme JAMAIS les connexions après coup, contrairement à
// la commande ace — ce process continue de s'en servir pour de vraies
// requêtes ensuite (voir le commentaire de migrateTenantConnection).
// Lors d'un redéploiement complet des services, svc-inscription peut démarrer
// avant que svc-auth (qui détient l'annuaire des bases) réponde : sans
// réessai, la liste restait vide et AUCUNE migration n'était appliquée, sans
// autre trace qu'une ligne d'erreur (vu au déploiement du 2026-10-13 : colonne
// registrations.documents_sent_at absente, inscriptions en erreur). On
// réessaie donc pendant ~2 minutes avant d'abandonner et d'alerter.
const REGISTRY_MAX_ATTEMPTS = 12
const REGISTRY_RETRY_DELAY_MS = 10_000

async function refreshRegistryWithRetry(): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await refreshTenantRegistry()
      return
    } catch (error) {
      if (attempt >= REGISTRY_MAX_ATTEMPTS) throw error
      logger.warn(
        `[migrate-boot] annuaire svc-auth injoignable (essai ${attempt}/${REGISTRY_MAX_ATTEMPTS}), nouvel essai dans ${REGISTRY_RETRY_DELAY_MS / 1000} s`
      )
      await new Promise((resolve) => setTimeout(resolve, REGISTRY_RETRY_DELAY_MS))
    }
  }
}

async function migrateAllTenantsOnBoot(): Promise<void> {
  await refreshRegistryWithRetry()

  const results = await runOnAllTenants(async (serviceId) =>
    migrateTenantConnection(app, connectionNameFor(serviceId))
  )

  const failures = results.filter((r) => r.error)
  const migrated = results.filter((r) => !r.error && r.migratedCount > 0)

  // Trace positive : sans elle, "aucune migration" et "annuaire vide" se
  // ressemblent dans les logs.
  logger.info(
    `[migrate-boot] ${results.length} base(s) vérifiée(s), ${migrated.length} migrée(s), ${failures.length} en échec`
  )

  for (const result of migrated) {
    logger.info(
      `[migrate-boot] ${result.connectionName} : ${result.migratedCount} migration(s) appliquée(s)`
    )
  }
  for (const result of failures) {
    logger.error(`[migrate-boot] ${result.connectionName} : échec — ${result.error!.message}`)
  }

  if (failures.length > 0) {
    await notifyOpsAlert(
      'Migration tenant en échec au déploiement (svc-inscription)',
      `${failures.length} base(s) en échec : ${failures.map((r) => r.connectionName).join(', ')}`
    )
  }
}

migrateAllTenantsOnBoot().catch(async (error) => {
  logger.error({ err: error }, '[migrate-boot] échec inattendu du balayage de migration')
  await notifyOpsAlert(
    'Migration au démarrage impossible (svc-inscription)',
    "L'annuaire svc-auth est resté injoignable : aucune base de service n'a été migrée. Redémarrer svc-inscription une fois svc-auth disponible."
  ).catch(() => undefined)
})
