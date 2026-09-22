import { BaseSchema } from '@adonisjs/lucid/schema'

// Jusqu'ici un code budgétaire n'était rattaché qu'à (org_id, numcli) —
// tenable tant qu'un numcli correspondait à un seul service, plus le cas
// depuis que plusieurs services d'un même organisme peuvent partager un
// numcli (voir link_code côté svc-auth). Un code budgétaire est en réalité
// toujours destiné à UN service précis : on le rattache maintenant
// explicitement, résolu via link_code au moment du dépôt (voir
// aregie_controller.ts#deposit). service_id nullable : les lignes
// existantes, déposées avant ce changement, n'ont aucune trace fiable du
// service visé — elles restent en base mais n'apparaîtront plus tant
// qu'elles n'auront pas été redéposées via le nouveau format (avec
// link_code).
export default class extends BaseSchema {
  protected tableName = 'budget_codes'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('service_id').nullable()
    })

    // L'ancienne contrainte (org_id, numcli, code) empêcherait deux
    // services qui partagent un numcli d'avoir chacun un code identique
    // (ex. un code "01" propre à chacun) — remplacée par (service_id,
    // code), la vraie clé naturelle désormais. Les NULL de service_id
    // (lignes historiques) ne se bloquent jamais entre eux : Postgres ne
    // les considère jamais égaux dans une contrainte unique.
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['org_id', 'numcli', 'code'])
      table.unique(['service_id', 'code'])
      table.index(['service_id'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['service_id', 'code'])
      table.dropIndex(['service_id'])
      table.unique(['org_id', 'numcli', 'code'])
      table.dropColumn('service_id')
    })
  }
}
