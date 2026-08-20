import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Libellés de tarifs plus parlants pour les services de démo/test
 * (services 1 et 2) — "plein"/"reduit"/"enfant" ne disaient rien à
 * l'affichage. Les lignes de commande déjà passées gardent leur propre
 * copie du libellé (voir TariffsController#destroy) : on ne touche donc
 * que le référentiel de tarifs, jamais l'historique.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(
      `UPDATE tariffs SET tariff_type = 'Adulte' WHERE service_id IN (1, 2) AND tariff_type = 'plein'`
    )
    this.schema.raw(
      `UPDATE tariffs SET tariff_type = 'Tarif réduit' WHERE service_id IN (1, 2) AND tariff_type = 'reduit'`
    )
    this.schema.raw(
      `UPDATE tariffs SET tariff_type = 'Enfant (-12 ans)' WHERE service_id = 1 AND tariff_type = 'enfant'`
    )
  }

  async down() {}
}
