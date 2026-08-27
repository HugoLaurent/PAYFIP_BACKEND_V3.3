import { BaseSchema } from '@adonisjs/lucid/schema'
import { EVENT_TYPES, EVENT_STATUSES } from '#database/enums'

export default class extends BaseSchema {
  protected tableName = 'events'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.integer('org_id').notNullable().index()
      table.integer('service_id').notNullable().index()

      table.enum('type', [...EVENT_TYPES]).notNullable()

      table.string('title').notNullable()
      // Identifiant d'URL citoyen (ex. "premiers-secours-psc1"), unique par
      // service — généré depuis `title` à la création si l'agent n'en
      // fournit pas, jamais recalculé ensuite même si `title` change
      // (romprait les liens déjà partagés/imprimés).
      table.string('slug').notNullable()
      table.text('description').nullable()

      table.date('event_date').nullable()
      // Créneau horaire structuré (ex. "09:00"/"17:00") — optionnel,
      // utilisé pour l'export calendrier (.ics) ; `time_label` reste la
      // source d'affichage (permet un texte libre type "9h–17h" même sans
      // horaires structurés, ou une nuance que start/end ne capturent pas).
      table.string('start_time').nullable()
      table.string('end_time').nullable()
      // Libellé libre affiché à côté de la date (ex. "9h–17h") — pas de
      // logique de créneau/horaire, juste ce que l'agent tape (voir
      // maquette : jamais de calcul de durée, un texte affiché tel quel).
      table.string('time_label').nullable()
      table.string('location').nullable()
      // Catégorie libre pour le filtre du catalogue citoyen (ex. "Sport",
      // "Culture") — pas d'enum : laissé à la main de l'agent, comme
      // `location`/`time_label`.
      table.string('category').nullable()
      table.timestamp('registration_deadline').nullable()

      table.integer('price_cents').notNullable().defaultTo(0)

      table.boolean('requires_documents').notNullable().defaultTo(false)
      table.text('document_instructions').nullable()

      // null = illimité (voir capacity_service.ts).
      table.integer('capacity').nullable()
      table.integer('max_participants_per_registration').notNullable().defaultTo(1)

      // Tableau de {key, label, type, required, options?} — voir
      // FORM_FIELD_TYPES et Registration.formResponses.
      table.jsonb('form_schema').nullable()

      table.enum('status', [...EVENT_STATUSES]).notNullable().defaultTo('draft')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.unique(['org_id', 'service_id', 'slug'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
