import { BaseSchema } from '@adonisjs/lucid/schema'
import { TARIFF_STATUSES } from '#database/enums'

export default class extends BaseSchema {
  protected tableName = 'tariffs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.integer('org_id').notNullable().index()
      table.integer('service_id').notNullable().index()

      table.string('tariff_type').notNullable()
      table.integer('price_cents').notNullable()
      table.enum('status', [...TARIFF_STATUSES]).notNullable().defaultTo('active')

      table.string('budget_code').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.unique(['service_id', 'tariff_type'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
