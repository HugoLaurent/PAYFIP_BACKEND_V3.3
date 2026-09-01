import { BaseSchema } from '@adonisjs/lucid/schema'
import { PAYMENT_REQUEST_STATUSES } from '#database/enums'

export default class extends BaseSchema {
  protected tableName = 'payment_requests'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.string('org_id').notNullable()
      // string ordinaire, pas de CHECK Postgres : validé uniquement côté
      // TS (SOURCE_SERVICES) pour qu'un futur service source n'exige plus
      // jamais de migration.
      table.string('source_service').notNullable()
      table.string('source_reference').notNullable()

      table.integer('service_id').nullable().index()
      table.integer('exer').nullable()
      table.string('payer_email').nullable()
      table.string('numcli', 6).nullable()

      table.integer('amount_cents').notNullable()

      table
        .enum('status', [...PAYMENT_REQUEST_STATUSES])
        .notNullable()
        .defaultTo('draft')

      table.string('payfip_id_op').unique()

      table.string('front_redirect_url').notNullable()
      table.string('webhook_url').notNullable()

      table
        .integer('retry_of_payment_request_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable(this.tableName)

      table.timestamp('paid_at').nullable()
      table.timestamp('expires_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })

    this.schema.raw(`
      CREATE UNIQUE INDEX payment_requests_active_source_reference_unique
      ON ${this.tableName} (source_service, source_reference)
      WHERE status NOT IN ('failed', 'cancelled', 'expired')
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
