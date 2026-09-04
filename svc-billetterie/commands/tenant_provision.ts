import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class TenantProvision extends BaseCommand {
  static commandName = 'tenant:provision'
  static description =
    "Crée (si besoin) et migre la base tenant d'un service billetterie, puis l'enregistre et l'active dans l'annuaire svc-auth"

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'id du service métier (svc-auth) à provisionner' })
  declare serviceId: string

  // Logique déportée dans app/services/tenant_provisioning_service.ts —
  // voir bin/provision_tenant.ts pour l'invoquer sans passer par le
  // kernel ace, seul contournement fiable connu du bug FsLoader.
  async run() {
    const serviceId = Number(this.serviceId)
    if (!Number.isInteger(serviceId) || serviceId <= 0) {
      this.logger.error('serviceId invalide — attendu un entier positif')
      this.exitCode = 1
      return
    }

    this.logger.info(`Provisionnement du service ${serviceId}...`)
    const { provisionTenantDatabase } = await import('#services/tenant_provisioning_service')
    try {
      const result = await provisionTenantDatabase(this.app, serviceId)
      this.logger.success(
        `Service ${serviceId} provisionné (${result.dbName}) — ${result.migratedCount} migration(s) — actif dans l'annuaire.`
      )
    } catch (error) {
      this.logger.error((error as Error).message)
      this.exitCode = 1
    }
  }

  async completed() {
    const lucidDb = await this.app.container.make('lucid.db')
    await lucidDb.manager.closeAll(true)
  }
}
