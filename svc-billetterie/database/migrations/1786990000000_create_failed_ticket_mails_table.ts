import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Filet de rattrapage distinct de la file de retry de svc-mail : une
 * ligne ici n'apparaît que quand l'appel vers svc-mail n'a même pas pu
 * aboutir (service injoignable), donc rien n'a jamais été enregistré de
 * son côté à rejouer. Le propriétaire du retry est l'appelant, pas
 * l'appelé — même principe que webhook_deliveries côté svc-gestion.
 */
export default class extends BaseSchema {
  protected tableName = 'failed_ticket_mails'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('order_id')
        .unsigned()
        .notNullable()
        .unique()
        .references('id')
        .inTable('orders')
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
