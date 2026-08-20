import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'scans'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('service_id').nullable().index()
      table.string('agent_label').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('service_id')
      table.dropColumn('agent_label')
    })
  }
}
