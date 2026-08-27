import { BaseSchema } from '@adonisjs/lucid/schema'
import { FAILED_REGISTRATION_MAIL_KINDS } from '#database/enums'

/**
 * Filet de rattrapage distinct de la file de retry de svc-mail : une ligne
 * ici n'apparaît que quand l'appel vers svc-mail n'a même pas pu aboutir
 * (service injoignable) — même principe que failed_ticket_mails côté
 * svc-billetterie. `registration_id` unique : une seule intention de mail
 * en échec à la fois par inscription (mail_kind indique laquelle), ce qui
 * correspond à la réalité des parcours (une seule relance email pertinente
 * par état de l'inscription).
 */
export default class extends BaseSchema {
  protected tableName = 'failed_registration_mails'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('registration_id')
        .unsigned()
        .notNullable()
        .unique()
        .references('id')
        .inTable('registrations')
        .onDelete('CASCADE')

      table.enum('mail_kind', [...FAILED_REGISTRATION_MAIL_KINDS]).notNullable()

      table.integer('attempts').notNullable().defaultTo(0)
      table.timestamp('next_retry_at').notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
