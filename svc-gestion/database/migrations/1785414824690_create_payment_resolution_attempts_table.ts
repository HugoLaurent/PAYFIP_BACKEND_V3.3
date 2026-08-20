import { BaseSchema } from '@adonisjs/lucid/schema'
import { RESOLUTION_TRIGGERS } from '#database/enums'

export default class extends BaseSchema {
  protected tableName = 'payment_resolution_attempts'

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

      table.enum('trigger', [...RESOLUTION_TRIGGERS]).notNullable()

      table.string('payfip_result_code').nullable()
      table.string('resulting_status').notNullable()
      table.jsonb('raw_response').nullable()

      table.timestamp('called_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
