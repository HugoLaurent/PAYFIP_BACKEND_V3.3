import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Données de démo/test plus lisibles pour les tests manuels et les
 * captures d'écran — l'organisme et ses services portaient des noms
 * génériques ("Demo Mixte", "Piscine Municipale A/B") qui ne ressemblent
 * à rien de réel.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(
      `UPDATE organizations SET name = 'Communauté de Communes du Pays de Kerlann' WHERE id = 1`
    )
    this.schema.raw(`UPDATE services SET name = 'Piscine de Kerlann' WHERE id = 1`)
    this.schema.raw(`UPDATE services SET name = 'Piscine des Salines' WHERE id = 2`)
    this.schema.raw(`UPDATE services SET name = 'Centre Hospitalier de Kerlann' WHERE id = 3`)
  }

  async down() {}
}
