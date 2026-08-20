import { BaseSchema } from '@adonisjs/lucid/schema'
import { WEBHOOK_EVENT_TYPES, WEBHOOK_DELIVERY_STATUSES } from '#database/enums'

export default class extends BaseSchema {
  protected tableName = 'webhook_deliveries'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('payment_request_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('payment_requests')
        .onDelete('CASCADE')
        .index()

      table.enum('event_type', [...WEBHOOK_EVENT_TYPES]).notNullable()

      table.string('target_url').notNullable()
      table.jsonb('payload').notNullable()

      table.enum('status', [...WEBHOOK_DELIVERY_STATUSES]).notNullable().defaultTo('pending')
      table.integer('attempts').notNullable().defaultTo(0)
      table.timestamp('next_retry_at').nullable()
      table.timestamp('delivered_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
