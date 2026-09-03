import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class TenantMigrate extends BaseCommand {
  static commandName = 'tenant:migrate'
  static description =
    "Lance les migrations en attente sur chaque base tenant inscription connue de l'annuaire svc-auth"

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

    for (const config of configs) {
      const result = await runOnTenant(config.serviceId, () =>
        migrateTenantConnection(this.app, connectionNameFor(config.serviceId))
      )

      if (result.error) {
        this.logger.error(
          `serviceId=${config.serviceId} (${result.connectionName}) : échec — ${result.error.message}`
        )
        continue
      }

      this.logger.info(
        `serviceId=${config.serviceId} (${result.connectionName}) : ${result.migratedCount} migration(s) appliquée(s)`
      )
    }
  }

  async completed() {
    const db = await this.app.container.make('lucid.db')
    await db.manager.closeAll(true)
  }
}
