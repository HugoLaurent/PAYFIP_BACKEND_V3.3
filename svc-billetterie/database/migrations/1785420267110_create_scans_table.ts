import { BaseSchema } from '@adonisjs/lucid/schema'
import { SCAN_RESULTS } from '#database/enums'

export default class extends BaseSchema {
  protected tableName = 'scans'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('ticket_id')
        .unsigned()
        .references('id')
        .inTable('tickets')
        .onDelete('SET NULL')
        .index()

      table.integer('org_id').notNullable().index()
      table.integer('service_id').nullable().index()
      table.integer('agent_id').notNullable()
      table.string('agent_label').nullable()

      table.enum('result', [...SCAN_RESULTS]).notNullable()
      table.string('reason')

      table.timestamp('created_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
