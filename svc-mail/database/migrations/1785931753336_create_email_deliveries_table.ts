import { BaseSchema } from '@adonisjs/lucid/schema'
import { EMAIL_DELIVERY_STATUSES } from '#database/enums'

export default class extends BaseSchema {
  protected tableName = 'email_deliveries'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.string('template').notNullable()
      table.string('to_email').notNullable()
      table.text('data').notNullable()

      table.enum('status', [...EMAIL_DELIVERY_STATUSES]).notNullable().defaultTo('pending')
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
