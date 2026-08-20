import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'budget_codes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.integer('org_id').notNullable()
      table.string('numcli').notNullable()
      table.string('code').notNullable()
      table.string('label').notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.unique(['org_id', 'numcli', 'code'])
      table.index(['org_id', 'numcli'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
