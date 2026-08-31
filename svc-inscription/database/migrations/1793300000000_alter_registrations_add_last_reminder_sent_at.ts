import { BaseSchema } from '@adonisjs/lucid/schema'

// Horodatage de la dernière relance manuelle envoyée par l'agent (bouton
// "Relancer" côté payfip-front) — sert de garde-fou anti-spam dans
// registrations_controller.ts#resendReminder, distinct des emails
// automatiques du parcours (confirmation, rejet, etc.) qui n'ont pas
// besoin de ce délai puisqu'ils ne se déclenchent qu'une fois par
// transition de statut.
export default class extends BaseSchema {
  protected tableName = 'registrations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('last_reminder_sent_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('last_reminder_sent_at')
    })
  }
}
