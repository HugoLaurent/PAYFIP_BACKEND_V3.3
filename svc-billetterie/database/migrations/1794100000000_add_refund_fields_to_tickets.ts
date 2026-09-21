import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * `refunded` existe dans TICKET_STATUSES depuis le début mais n'était
 * jamais posé nulle part — PayFiP/svc-gestion n'a pas de fonction de
 * remboursement réel, l'argent est rendu hors plateforme par l'organisme.
 * Ces colonnes ne servent qu'à déclarer/tracer ce remboursement côté
 * agent (qui, quand, pourquoi), même pattern que consumed_at/consumed_by.
 */
export default class extends BaseSchema {
  protected tableName = 'tickets'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('refunded_at').nullable()
      table.integer('refunded_by').nullable()
      table.string('refunded_by_label').nullable()
      table.text('refund_reason').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('refunded_at')
      table.dropColumn('refunded_by')
      table.dropColumn('refunded_by_label')
      table.dropColumn('refund_reason')
    })
  }
}
