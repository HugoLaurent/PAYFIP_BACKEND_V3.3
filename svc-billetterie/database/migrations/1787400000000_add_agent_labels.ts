import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('orders', (table) => {
      table.string('sold_by').nullable()
    })
    this.schema.alterTable('tickets', (table) => {
      table.string('consumed_by_label').nullable()
    })
  }

  async down() {
    this.schema.alterTable('orders', (table) => {
      table.dropColumn('sold_by')
    })
    this.schema.alterTable('tickets', (table) => {
      table.dropColumn('consumed_by_label')
    })
  }
}
