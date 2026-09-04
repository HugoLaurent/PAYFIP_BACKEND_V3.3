/**
 * Provisionne une base tenant sans passer par `node ace tenant:provision`.
 *
 * Sur le VPS de démo, invoquer cette logique via le kernel ace fait
 * planter la validation des métadonnées d'un fichier voisin de
 * commands/ ("Invalid URL" — non reproduit en local, en dev comme en
 * build de prod). ace scanne et valide TOUS les fichiers de commands/
 * avant d'exécuter le moindre (FsLoader), donc un seul fichier voisin
 * cassé bloque tenant:provision même si son propre code est sain. Ce
 * script boote l'app à l'identique de bin/console.ts mais sans jamais
 * passer par le kernel ace — donc jamais par FsLoader.
 *
 * Usage : node bin/provision_tenant.js <serviceId>
 */
await import('reflect-metadata')
const { Ignitor, prettyPrintError } = await import('@adonisjs/core')

const APP_ROOT = new URL('../', import.meta.url)

const IMPORTER = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, APP_ROOT).href)
  }
  return import(filePath)
}

const serviceId = Number(process.argv[2])
if (!Number.isInteger(serviceId) || serviceId <= 0) {
  console.error('Usage: node bin/provision_tenant.js <serviceId>')
  process.exit(1)
}

const ignitor = new Ignitor(APP_ROOT, { importer: IMPORTER })
const app = ignitor.createApp('console')

try {
  app.booting(async () => {
    await import('#start/env')
  })
  await app.init()
  await app.boot()
  await app.start(() => {})

  const { provisionTenantDatabase } = await import('#services/tenant_provisioning_service')
  const result = await provisionTenantDatabase(app, serviceId)
  console.log(
    `Service ${serviceId} provisionné (${result.dbName}) — ${result.migratedCount} migration(s) — actif dans l'annuaire.`
  )
} catch (error) {
  prettyPrintError(error)
  process.exitCode = 1
} finally {
  const db = await app.container.make('lucid.db')
  await db.manager.closeAll(true)
  await app.terminate()
}
