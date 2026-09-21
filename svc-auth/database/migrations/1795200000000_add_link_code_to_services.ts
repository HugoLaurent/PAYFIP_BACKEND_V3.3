import { randomBytes } from 'node:crypto'
import { BaseSchema } from '@adonisjs/lucid/schema'

// Identifiant technique propre à CHAQUE service, distinct du numcli : le
// numcli peut désormais être partagé entre plusieurs services d'un même
// organisme (une facturation commune à deux billetteries, par exemple),
// donc il ne suffit plus à retrouver LE service exact d'une ligne de dépôt
// AREGIE. link_code, lui, reste unique service par service — c'est lui
// qu'on transmet à AREGIE pour qu'il nous le renvoie sur chaque ligne (le
// numcli continue d'être envoyé en plus, toujours nécessaire pour vérifier
// le paiement PayFiP). Voir services_controller.ts#byLinkCode.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // sans 0/O/1/I/L, ambigus à recopier à la main

function generateLinkCode(): string {
  const bytes = randomBytes(8)
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return code
}

export default class extends BaseSchema {
  protected tableName = 'services'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('link_code', 16).nullable()
    })

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
      table.dropColumn('link_code')
    })
  }
}
