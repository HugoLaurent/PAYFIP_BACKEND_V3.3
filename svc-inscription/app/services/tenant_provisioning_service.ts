import type { ApplicationService } from '@adonisjs/core/types'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'

// Logique extraite de commands/tenant_provision.ts pour être appelable sans
// passer par le kernel ace (FsLoader) — voir bin/provision_tenant.ts. Sur le
// VPS de démo, invoquer cette même logique via `node ace tenant:provision`
// fait planter la validation des métadonnées d'un fichier voisin du dossier
// commands/ ("Invalid URL", cause non identifiée, non reproductible en
// local ni en build de prod local) : ace scanne et valide TOUS les fichiers
// de commands/ avant d'exécuter le moindre, donc un seul fichier voisin
// bloque tenant:provision même si tenant_provision.ts lui-même est sain.
export async function provisionTenantDatabase(app: ApplicationService, serviceId: number) {
  const dbName = `svc_inscription_tenant_${serviceId}`
  const connectionConfig = {
    host: env.get('DB_HOST'),
    port: env.get('DB_PORT'),
    user: env.get('DB_USER'),
    password: env.get('DB_PASSWORD'),
  }

  const existing = await db.rawQuery('SELECT 1 FROM pg_database WHERE datname = ?', [dbName])
  if (existing.rows.length === 0) {
    await db.rawQuery(`CREATE DATABASE "${dbName}"`)
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
  const result = await migrateTenantConnection(app, connectionName)
  if (result.error) {
    throw new Error(`Échec des migrations sur ${connectionName} : ${result.error.message}`)
  }

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

  return { dbName, migratedCount: result.migratedCount }
}
