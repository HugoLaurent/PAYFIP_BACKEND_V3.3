import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_service_assignments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
        .index()

      table
        .integer('service_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('services')
        .onDelete('CASCADE')
        .index()

      table.timestamp('assigned_at').notNullable()

      table.boolean('can_sell').notNullable().defaultTo(true)
      table.boolean('can_scan').notNullable().defaultTo(true)
      table.boolean('can_manage_tariffs').notNullable().defaultTo(false)
      table.boolean('can_view_history').notNullable().defaultTo(true)
      table.boolean('can_toggle_service').notNullable().defaultTo(false)

      table.unique(['user_id', 'service_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
