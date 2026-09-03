import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'invoice_payment_attempts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('invoice_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('invoices')
        .onDelete('CASCADE')
        .index()

      // Rattache l'essai à la ligne svc-gestion qui l'a ouvert — sert
      // uniquement à retrouver la bonne ligne au moment du webhook
      // (payload.paymentRequestId), jamais transmis à svc-gestion.
      table.integer('payment_request_id').notNullable()

      // string ordinaire, pas de CHECK Postgres : validé uniquement côté
      // TS (PAYMENT_ATTEMPT_STATUSES) — un futur statut n'exige plus de
      // migration (voir le même choix côté svc-billetterie).
      table.string('status').notNullable().defaultTo('awaiting_payment')
      table.boolean('is_retry').notNullable()
      table.timestamp('paid_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
