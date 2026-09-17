import { BaseSchema } from '@adonisjs/lucid/schema'

// Table à une seule ligne (id=1) : remplace Vault pour ce secret unique
// (clé API AREGIE Mail), saisie par un admin depuis le back office plutôt
// que déployée via une variable d'environnement — voir
// aregie_mail_settings_service.ts pour le chiffrement au repos.
export default class extends BaseSchema {
  protected tableName = 'aregie_mail_settings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.text('api_key_encrypted').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
