import { BaseSchema } from '@adonisjs/lucid/schema'
import { TICKET_STATUSES } from '#database/enums'

export default class extends BaseSchema {
  protected tableName = 'tickets'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('order_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('orders')
        .onDelete('CASCADE')
        .index()

      table.integer('org_id').notNullable().index()
      table.integer('service_id').notNullable().index()

      table.string('tariff_type').notNullable()
      table.integer('price_at_purchase_cents').notNullable()
      table.date('visit_date').notNullable()

      table
        .enum('status', [...TICKET_STATUSES])
        .notNullable()
        .defaultTo('issued')

      table.timestamp('consumed_at')
      table.integer('consumed_by')
      table.string('consumed_by_label').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
