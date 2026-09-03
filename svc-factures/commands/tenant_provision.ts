import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'

export default class TenantProvision extends BaseCommand {
  static commandName = 'tenant:provision'
  static description =
    "Crée (si besoin) et migre la base tenant d'un service factures, puis l'enregistre et l'active dans l'annuaire svc-auth"

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'id du service métier (svc-auth) à provisionner' })
  declare serviceId: string

  async run() {
    const serviceId = Number(this.serviceId)
    if (!Number.isInteger(serviceId) || serviceId <= 0) {
      this.logger.error('serviceId invalide — attendu un entier positif')
      this.exitCode = 1
      return
    }

    // Créée dans le conteneur Postgres existant du service (dev-pg-svc-
    // factures en local) — pas de nouveau conteneur par tenant, voir §4
    // du plan de migration DB-per-tenant. dbName n'est jamais interpolé
    // depuis une entrée libre : il vient uniquement de ce gabarit.
    const dbName = `svc_factures_tenant_${serviceId}`
    const connectionConfig = {
      host: env.get('DB_HOST'),
      port: env.get('DB_PORT'),
      user: env.get('DB_USER'),
      password: env.get('DB_PASSWORD'),
    }

    this.logger.info(`Vérification de la base ${dbName} sur ${connectionConfig.host}:${connectionConfig.port}...`)
    const existing = await db.rawQuery('SELECT 1 FROM pg_database WHERE datname = ?', [dbName])
    if (existing.rows.length === 0) {
      this.logger.info(`Création de ${dbName}...`)
      await db.rawQuery(`CREATE DATABASE "${dbName}"`)
    } else {
      this.logger.info(`${dbName} existe déjà.`)
    }

    const { connectionNameFor } = await import('#services/tenant_connection_service')
    const connectionName = connectionNameFor(serviceId)
    if (!db.manager.has(connectionName)) {
      db.manager.add(connectionName, {
        client: 'pg',
        connection: { ...connectionConfig, database: dbName },
        migrations: { naturalSort: true, paths: ['database/migrations'] },
      })
    }

    const { migrateTenantConnection } = await import('#services/tenant_migration_service')
    const result = await migrateTenantConnection(this.app, connectionName)
    if (result.error) {
      this.logger.error(`Échec des migrations sur ${connectionName} : ${result.error.message}`)
      this.exitCode = 1
      return
    }
    this.logger.info(`${result.migratedCount} migration(s) appliquée(s) sur ${connectionName}`)

    const { registerTenantDatabase, activateTenantDatabase } = await import(
      '#services/tenant_registry_client'
    )
    const registered = await registerTenantDatabase({
      serviceId,
      dbHost: connectionConfig.host,
      dbPort: connectionConfig.port,
      dbName,
      dbUser: connectionConfig.user,
      dbPassword: connectionConfig.password ?? '',
    })
    await activateTenantDatabase(registered.id)

    this.logger.success(`Service ${serviceId} provisionné (${dbName}) — actif dans l'annuaire.`)
  }

  async completed() {
    const lucidDb = await this.app.container.make('lucid.db')
    await lucidDb.manager.closeAll(true)
  }
}
