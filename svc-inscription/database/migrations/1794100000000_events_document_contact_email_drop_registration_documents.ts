import { BaseSchema } from '@adonisjs/lucid/schema'

// Les justificatifs ne transitent plus par PayFiP : le citoyen les envoie
// par email à l'adresse de contact de l'évènement, en citant la référence
// de son inscription. On ne stocke donc plus aucune pièce (identité,
// permis, justificatif de domicile…) — la table registration_documents est
// supprimée avec son contenu (aucune donnée de production à préserver au
// moment de cette migration).
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('events', (table) => {
      table.string('document_contact_email').nullable()
    })

    this.schema.dropTable('registration_documents')
  }

  async down() {
    this.schema.createTable('registration_documents', (table) => {
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
      table.boolean('is_current').notNullable().defaultTo(true)
      table.string('document_key').notNullable().defaultTo('justificatif')
      table.timestamp('created_at').notNullable()
    })

    this.schema.alterTable('events', (table) => {
      table.dropColumn('document_contact_email')
    })
  }
}
