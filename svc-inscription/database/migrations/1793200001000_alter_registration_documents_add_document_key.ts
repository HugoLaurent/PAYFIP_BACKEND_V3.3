import { BaseSchema } from '@adonisjs/lucid/schema'

// Rattache chaque fichier déjà déposé à une exigence — voir
// 1793200000000_alter_events_document_requirements.ts. Les documents
// existants (déposés avant cette migration, sous l'ancien régime
// requires_documents générique) sont rattachés à la clé 'justificatif',
// celle utilisée par la migration jumelle pour convertir les évènements
// concernés — la cohérence entre les deux tables est donc préservée.
export default class extends BaseSchema {
  protected tableName = 'registration_documents'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('document_key').notNullable().defaultTo('justificatif')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('document_key')
    })
  }
}
