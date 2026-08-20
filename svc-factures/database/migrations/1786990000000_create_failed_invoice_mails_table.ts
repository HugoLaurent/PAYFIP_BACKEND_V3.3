import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Même principe que failed_ticket_mails côté svc-billetterie : rattrape
 * le cas où svc-mail est injoignable (pas juste en échec d'envoi SMTP),
 * cas que la file de retry de svc-mail ne peut pas voir puisque rien n'y
 * a jamais été enregistré.
 */
export default class extends BaseSchema {
  protected tableName = 'failed_invoice_mails'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('invoice_id')
        .unsigned()
        .notNullable()
        .unique()
        .references('id')
        .inTable('invoices')
        .onDelete('CASCADE')

      table.integer('attempts').notNullable().defaultTo(0)
      table.timestamp('next_retry_at').notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
