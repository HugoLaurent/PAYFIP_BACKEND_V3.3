import { BaseSchema } from '@adonisjs/lucid/schema'

// Réglages propres au service (une base par service = une seule ligne, id 1).
// Aujourd'hui : la boîte qui REÇOIT les pièces justificatives des citoyens
// (relayées par email, jamais stockées) et ses copies. Saisis dans
// Services > Paramètres, valables pour tous les évènements du service.
export default class extends BaseSchema {
  protected tableName = 'service_settings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('document_contact_email').nullable()
      table.jsonb('document_contact_cc').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
