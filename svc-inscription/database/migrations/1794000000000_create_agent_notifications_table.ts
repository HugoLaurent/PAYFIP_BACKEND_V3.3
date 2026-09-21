import { BaseSchema } from '@adonisjs/lucid/schema'
import { AGENT_NOTIFICATION_TYPES } from '#database/enums'

/**
 * Flux d'activité pour l'agent (voir agent_notifications_service.ts) —
 * une ligne par action du citoyen (ou expiration automatique) qui mérite
 * un signal côté organisme, distinct de pending-review-count (qui compte
 * un état courant, pas un événement ponctuel). citizen_name/event_title
 * dénormalisés : l'inscription ou l'évènement peuvent avoir changé (ou
 * l'inscription être un jour purgée) sans que la notification perde son
 * sens pour l'historique.
 */
export default class extends BaseSchema {
  protected tableName = 'agent_notifications'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.integer('org_id').notNullable().index()
      table.integer('service_id').notNullable().index()

      table
        .integer('event_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('events')
        .onDelete('CASCADE')
        .index()

      table
        .integer('registration_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('registrations')
        .onDelete('CASCADE')

      table.enum('type', [...AGENT_NOTIFICATION_TYPES]).notNullable()

      table.string('citizen_name').notNullable()
      table.string('event_title').notNullable()

      table.timestamp('read_at').nullable()

      table.timestamp('created_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
