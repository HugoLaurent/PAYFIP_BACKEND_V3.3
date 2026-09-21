import { randomBytes } from 'node:crypto'
import { BaseSchema } from '@adonisjs/lucid/schema'

// Sans 0/O/1/I/L, ambigus à recopier à la main — c'est un code que Hugo
// transmet lui-même à AREGIE (voir services_controller.ts#byLinkCode).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function generateLinkCode(): string {
  const bytes = randomBytes(8)
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return code
}

// Backfill séparé de add_link_code_to_services : la colonne doit déjà
// exister en base (DDL de la migration précédente appliqué), ce que
// garantit l'exécution migration-par-migration du Migrator — jamais sûr
// dans le MÊME up() puisque this.schema.alterTable() y est différé.
export default class extends BaseSchema {
  protected tableName = 'services'

  async up() {
    const rows = await this.db.from(this.tableName).select('id')
    const used = new Set<string>()
    for (const row of rows) {
      let code = generateLinkCode()
      while (used.has(code)) code = generateLinkCode()
      used.add(code)
      await this.db.from(this.tableName).where('id', row.id).update({ link_code: code })
    }

    this.schema.alterTable(this.tableName, (table) => {
      table.string('link_code', 16).notNullable().alter()
      table.unique(['link_code'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['link_code'])
    })
  }
}
