import { BaseSchema } from '@adonisjs/lucid/schema'

// Distingue les deux formes de "vous devez refaire quelque chose" que
// l'agent peut envoyer sur une inscription `awaiting_review` : un vrai
// rejet (les documents déposés ne conviennent pas, le citoyen doit tout
// redéposer) vs. une simple demande de document supplémentaire (les
// documents déjà déposés restent valables, le citoyen n'a qu'à en ajouter
// un — voir registrations_controller.ts#review et #replaceDocuments).
export default class extends BaseSchema {
  protected tableName = 'registrations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('keep_existing_documents').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('keep_existing_documents')
    })
  }
}
