import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Statut de suivi propre à AREGIE (règlement CB/virement, non soldé,
 * annulé, mis en titre de perception...) — vocabulaire externe, purement
 * informatif. Ne pilote jamais `status`, qui reste notre seule vérité sur
 * l'état réel du paiement (piloté par PayFiP via svc-gestion).
 */
export default class extends BaseSchema {
  protected tableName = 'invoices'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('aregie_status').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('aregie_status')
    })
  }
}
