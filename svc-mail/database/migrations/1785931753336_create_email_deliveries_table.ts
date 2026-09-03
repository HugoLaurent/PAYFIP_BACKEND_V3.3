import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'email_deliveries'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.string('template').notNullable()
      table.string('to_email').notNullable()
      table.text('data').notNullable()

      // string ordinaire, pas table.enum() : une contrainte CHECK Postgres
      // casserait dès qu'un nouveau statut (ex. 'fake') est ajouté sans
      // migration ALTER dédiée — même correctif que service_type/
      // source_service (commit 09acb42).
      table.string('status').notNullable().defaultTo('pending')
      table.integer('attempts').notNullable().defaultTo(0)
      table.text('error').nullable()
      table.timestamp('next_retry_at').nullable()
      table.timestamp('sent_at').nullable()
      table.text('attachments').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
