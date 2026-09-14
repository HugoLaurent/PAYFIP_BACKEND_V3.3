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
async function migrateAllTenantsOnBoot(): Promise<void> {
  await refreshTenantRegistry()

  const results = await runOnAllTenants(async (serviceId) =>
    migrateTenantConnection(app, connectionNameFor(serviceId))
  )

  const failures = results.filter((r) => r.error)
  const migrated = results.filter((r) => !r.error && r.migratedCount > 0)

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
      'Migration tenant en échec au déploiement (svc-factures)',
      `${failures.length} base(s) en échec : ${failures.map((r) => r.connectionName).join(', ')}`
    )
  }
}

migrateAllTenantsOnBoot().catch((error) =>
  logger.error({ err: error }, '[migrate-boot] échec inattendu du balayage de migration')
)
