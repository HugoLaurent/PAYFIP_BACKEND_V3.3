import { BaseSchema } from '@adonisjs/lucid/schema'

// Copies (CC) de l'email qui relaie les pièces justificatives à l'agent —
// voir Event.documentContactCc. Liste JSON d'adresses, nullable.
export default class extends BaseSchema {
  protected tableName = 'events'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('document_contact_cc').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('document_contact_cc')
    })
  }
}
