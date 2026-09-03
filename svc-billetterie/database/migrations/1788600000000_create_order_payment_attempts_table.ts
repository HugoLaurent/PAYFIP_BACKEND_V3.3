import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'order_payment_attempts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('order_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('orders')
        .onDelete('CASCADE')
        .index()

      // Rattache l'essai à la ligne svc-gestion qui l'a ouvert — sert
      // uniquement à retrouver la bonne ligne au moment du webhook
      // (payload.paymentRequestId), jamais transmis à svc-gestion.
      table.integer('payment_request_id').notNullable()

      // string ordinaire, pas de CHECK Postgres — même raisonnement que
      // service_type côté svc-auth : un futur statut (ex. 'expired',
      // ajouté après coup) n'exige plus de migration, validé uniquement
      // côté TS (PAYMENT_ATTEMPT_STATUSES).
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
