import { BaseSchema } from '@adonisjs/lucid/schema'
import { INVOICE_STATUSES } from '#database/enums'

export default class extends BaseSchema {
  protected tableName = 'invoices'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('org_id').notNullable()

      table.integer('service_id').nullable().index()

      table.string('hospital_reference').notNullable() 
      table.integer('amount_cents').notNullable() 
      table.string('object_label').notNullable()

      table.integer('fiscal_year').notNullable() 

      table.string('client_number').nullable()

      table
        .enum('status', [...INVOICE_STATUSES])
        .notNullable()
        .defaultTo('draft')
      table.integer('payment_request_id').nullable()
      table.string('payment_reference').nullable()

      table.string('payfip_id_op').nullable()

      table.string('payer_email').nullable()

      table.timestamp('deposited_at').nullable()

      table.timestamp('collected_at').nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.unique(['org_id', 'hospital_reference'])
      table.unique(['payment_reference'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
