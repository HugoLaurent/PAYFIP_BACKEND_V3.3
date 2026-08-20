import { BaseSchema } from '@adonisjs/lucid/schema'
import { ORGANIZATION_STATUSES } from '#database/enums'

export default class extends BaseSchema {
  protected tableName = 'organizations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.string('name').notNullable()
      table.string('domain').notNullable().unique()
      table.enum('status', [...ORGANIZATION_STATUSES]).notNullable().defaultTo('active')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
