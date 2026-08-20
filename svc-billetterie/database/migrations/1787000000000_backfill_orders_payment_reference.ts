import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Avant l'ajout d'une référence aux ventes agent, ces commandes ont été
 * créées sans `payment_reference` — le PDF des billets retombait alors sur
 * l'id brut de la commande, différent de ce qu'affichait le site (rien).
 * On aligne les commandes existantes sur le même format que les nouvelles.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(
      `UPDATE orders SET payment_reference = 'BILL' || LPAD(id::text, 8, '0') WHERE payment_reference IS NULL`
    )
  }

  async down() {}
}
