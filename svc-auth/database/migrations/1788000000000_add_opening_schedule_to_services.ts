import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'services'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Les trois nullable ensemble : pas d'horaires configurés du tout
      // (cas par défaut, y compris tous les services existants) veut dire
      // "toujours ouvert", comme avant l'ajout de cette fonctionnalité.
      table.specificType('opening_days', 'integer[]').nullable()
      table.string('opening_start_time', 5).nullable()
      table.string('opening_end_time', 5).nullable()
    })

    this.schema.createTable('service_closures', (table) => {
      table.increments('id')

      table
        .integer('service_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('services')
        .onDelete('CASCADE')
        .index()

      table.string('label').notNullable()
      table.date('start_date').notNullable()
      table.date('end_date').notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable('service_closures')
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('opening_days')
      table.dropColumn('opening_start_time')
      table.dropColumn('opening_end_time')
    })
  }
}
