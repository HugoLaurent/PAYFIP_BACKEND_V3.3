import { BaseSchema } from '@adonisjs/lucid/schema'

// Le citoyen coche "j'ai bien envoyé mes pièces par email" sur sa page de
// suivi : on garde la date pour que l'agent sache qu'il peut aller relire sa
// messagerie (aucune pièce ne transite par PayFiP). Remis à null quand
// l'agent refuse les pièces — le citoyen doit alors re-déclarer son renvoi.
export default class extends BaseSchema {
  protected tableName = 'registrations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('documents_sent_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('documents_sent_at')
    })
  }
}
