import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class TenantMigrate extends BaseCommand {
  static commandName = 'tenant:migrate'
  static description =
    "Lance les migrations en attente sur chaque base tenant factures connue de l'annuaire svc-auth"

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const { refreshTenantRegistry, listAllTenantConfigs } = await import(
      '#services/tenant_registry_client'
    )
    const { runOnTenant, connectionNameFor } = await import('#services/tenant_connection_service')
    const { migrateTenantConnection } = await import('#services/tenant_migration_service')

    await refreshTenantRegistry()
    const configs = listAllTenantConfigs()

    if (configs.length === 0) {
      this.logger.info("Aucune base tenant active dans l'annuaire — rien à migrer.")
      return
    }

    // Séquentiel, pas Promise.all : attribution d'erreur plus simple par
    // tenant en phase 1 (voir §3 du plan de migration DB-per-tenant).
    let failureCount = 0

    for (const config of configs) {
      const result = await runOnTenant(config.serviceId, () =>
        migrateTenantConnection(this.app, connectionNameFor(config.serviceId))
      )

      if (result.error) {
        failureCount++
        this.logger.error(
          `serviceId=${config.serviceId} (${result.connectionName}) : échec — ${result.error.message}`
        )
        continue
      }

      this.logger.info(
        `serviceId=${config.serviceId} (${result.connectionName}) : ${result.migratedCount} migration(s) appliquée(s)`
      )
    }

    // Sans ça, la commande sort en succès même si toutes les bases ont
    // échoué — rien pour un script/pipeline qui vérifierait le code de
    // sortie plutôt que de parser les logs.
    if (failureCount > 0) {
      this.exitCode = 1
    }
  }

  async completed() {
    const db = await this.app.container.make('lucid.db')
    await db.manager.closeAll(true)
  }
}
