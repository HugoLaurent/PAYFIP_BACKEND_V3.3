import { BaseSchema } from '@adonisjs/lucid/schema'
import { ORDER_STATUSES, PAYMENT_METHODS } from '#database/enums'

export default class extends BaseSchema {
  protected tableName = 'orders'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.integer('org_id').notNullable().index()
      table.integer('service_id').notNullable().index()

      table.string('email').notNullable()
      table.date('visit_date').notNullable()
      table.integer('qty_tickets').notNullable()
      table.integer('total_amount_cents').notNullable()

      table
        .enum('status', [...ORDER_STATUSES])
        .notNullable()
        .defaultTo('draft')

      table.enum('payment_method', [...PAYMENT_METHODS]).notNullable()

      table.string('payment_reference').unique()
      table.integer('payment_request_id')
      table.string('payfip_id_op').nullable()
      // Preuve de possession pour retrouver ses billets côté citoyen quand
      // il n'y a pas de payfip_id_op (commande gratuite, jamais de session
      // PayFiP) — générée à la création, jamais réutilisée comme payfip_id_op.
      table.string('access_token').nullable()

      table.integer('retry_count').notNullable().defaultTo(0)

      table.integer('agent_id')
      table.string('sold_by').nullable()

      table.timestamp('otp_verified_at')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
