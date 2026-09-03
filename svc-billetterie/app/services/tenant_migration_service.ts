import type { ApplicationService } from '@adonisjs/core/types'
import { MigrationRunner } from '@adonisjs/lucid/migration'

export interface TenantMigrationResult {
  connectionName: string
  migratedCount: number
  error: Error | null
}

/**
 * Migre UNE base tenant déjà enregistrée dans db.manager. Ne ferme JAMAIS
 * la connexion elle-même via runner.close() — cette méthode appelle
 * db.manager.closeAll() en interne, ce qui fermerait toutes les
 * connexions enregistrées, pas seulement celle-ci. C'est à l'appelant
 * (commande ace) de décider du cycle de vie des connexions, une seule
 * fois à la fin via son hook completed().
 */
export async function migrateTenantConnection(
  app: ApplicationService,
  connectionName: string
): Promise<TenantMigrationResult> {
  const db = await app.container.make('lucid.db')
  const runner = new MigrationRunner(db, app, {
    direction: 'up',
    connectionName,
  })

  await runner.run()

  return {
    connectionName,
    migratedCount: Object.keys(runner.migratedFiles).length,
    error: runner.error,
  }
}
