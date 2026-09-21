import { BaseSchema } from '@adonisjs/lucid/schema'

// Identifiant technique propre à CHAQUE service, distinct du numcli : le
// numcli peut désormais être partagé entre plusieurs services d'un même
// organisme (une facturation commune à deux billetteries, par exemple),
// donc il ne suffit plus à retrouver LE service exact d'une ligne de dépôt
// AREGIE. link_code, lui, reste unique service par service — c'est lui
// qu'on transmet à AREGIE pour qu'il nous le renvoie sur chaque ligne (le
// numcli continue d'être envoyé en plus, toujours nécessaire pour vérifier
// le paiement PayFiP). Voir services_controller.ts#byLinkCode.
//
// Colonne ajoutée nullable ici seulement : `this.schema.alterTable()` est
// différé par Lucid (exécuté après la fin de up(), pas immédiatement), donc
// le backfill + la contrainte NOT NULL/unique doivent vivre dans la
// migration SUIVANTE pour être sûrs que la colonne existe déjà en base au
// moment d'écrire dedans.
export default class extends BaseSchema {
  protected tableName = 'services'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('link_code', 16).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('link_code')
    })
  }
}
