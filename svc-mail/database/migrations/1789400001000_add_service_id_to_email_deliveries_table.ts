import { BaseSchema } from '@adonisjs/lucid/schema'

// Nullable : les emails sans service (OTP) n'en ont pas — voir
// aregie_mail_settings_service.ts#resolveApiKey pour le repli associé.
export default class extends BaseSchema {
  protected tableName = 'email_deliveries'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('service_id').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('service_id')
    })
  }
}
