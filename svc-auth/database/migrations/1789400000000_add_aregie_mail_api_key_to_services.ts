import { BaseSchema } from '@adonisjs/lucid/schema'

// AES-256-GCM : base64(iv|authTag|ciphertext) — même schéma que
// tenant_databases.db_password_enc, voir tenant_credentials_service.ts.
// Un service sans clé propre utilise la clé "par défaut" côté svc-mail
// (emails sans service, ex. OTP) — jamais en clair au repos.
export default class extends BaseSchema {
  protected tableName = 'services'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('aregie_mail_api_key_enc').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('aregie_mail_api_key_enc')
    })
  }
}
