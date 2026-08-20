import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'otp_codes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.string('email').notNullable().index()
      table.string('code').notNullable()
      table.timestamp('expires_at').notNullable()
      table.timestamp('verified_at')

      table.integer('attempts').notNullable().defaultTo(0)

      table.timestamp('created_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
