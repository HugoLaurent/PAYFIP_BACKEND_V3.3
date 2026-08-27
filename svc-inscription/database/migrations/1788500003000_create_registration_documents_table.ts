import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'registration_documents'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('registration_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('registrations')
        .onDelete('CASCADE')
        .index()

      table.string('filename').notNullable()
      table.string('mime_type').notNullable()
      table.binary('file_data').notNullable()
      table.integer('size_bytes').notNullable()

      // Un re-dépôt après rejet (maquette) marque l'ancien document
      // `false` au lieu de le supprimer — historique conservé pour
      // l'agent, jamais purgé avant 6 mois (voir plan, hors périmètre v1
      // la réutilisation automatique inter-évènements).
      table.boolean('is_current').notNullable().defaultTo(true)

      table.timestamp('created_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
