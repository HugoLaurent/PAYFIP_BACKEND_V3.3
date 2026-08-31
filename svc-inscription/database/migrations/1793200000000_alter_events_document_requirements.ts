import { BaseSchema } from '@adonisjs/lucid/schema'

// Remplace le couple requires_documents (bool) + document_instructions
// (texte libre) par une vraie liste d'exigences nommées — voir
// Event.DocumentRequirement. Un évènement qui avait requires_documents=true
// est converti en une exigence unique reprenant l'ancien texte d'instructions,
// pour ne perdre aucune donnée existante ; l'agent peut ensuite l'affiner
// (la scinder en plusieurs pièces nommées) depuis le formulaire.
export default class extends BaseSchema {
  protected tableName = 'events'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('document_requirements').nullable()
    })

    this.schema.raw(`
      UPDATE ${this.tableName}
      SET document_requirements = jsonb_build_array(
        jsonb_build_object(
          'key', 'justificatif',
          'label', 'Justificatif',
          'instructions', document_instructions,
          'required', true
        )
      )
      WHERE requires_documents = true
    `)

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('requires_documents')
      table.dropColumn('document_instructions')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('requires_documents').notNullable().defaultTo(false)
      table.text('document_instructions').nullable()
    })

    this.schema.raw(`
      UPDATE ${this.tableName}
      SET requires_documents = (document_requirements IS NOT NULL AND jsonb_array_length(document_requirements) > 0),
          document_instructions = document_requirements -> 0 ->> 'instructions'
    `)

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('document_requirements')
    })
  }
}
