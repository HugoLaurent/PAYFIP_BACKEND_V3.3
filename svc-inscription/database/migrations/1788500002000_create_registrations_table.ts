import { BaseSchema } from '@adonisjs/lucid/schema'
import { REGISTRATION_STATUSES, PAYMENT_METHODS } from '#database/enums'

export default class extends BaseSchema {
  protected tableName = 'registrations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.integer('org_id').notNullable().index()
      table.integer('service_id').notNullable().index()

      // Pas de CASCADE : un évènement avec des inscriptions ne doit jamais
      // pouvoir être supprimé en base sans que quelqu'un décide
      // explicitement du sort de son historique d'inscrits — la route
      // DELETE /events/:id (réservée aux évènements déjà `archived`) est le
      // seul chemin de suppression prévu, pas une cascade silencieuse.
      table
        .integer('event_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('events')
        .index()

      table.string('first_name').notNullable()
      table.string('last_name').notNullable()
      table.string('email').notNullable().index()

      // Nombre de places occupées par cette inscription (maquette :
      // inscription multi-participants) — compte dans le calcul de
      // capacité, voir capacity_service.ts.
      table.integer('quantity').notNullable().defaultTo(1)

      // Réponses au formulaire dynamique de l'évènement (Event.formSchema),
      // null si l'évènement n'en définit pas.
      table.jsonb('form_responses').nullable()

      table
        .enum('status', [...REGISTRATION_STATUSES])
        .notNullable()
        .defaultTo('awaiting_review')

      // Prix unitaire x quantity, figé à l'inscription — ne doit jamais
      // varier si le tarif de l'évènement change ensuite.
      table.integer('price_cents_at_registration').notNullable()

      table.enum('payment_method', [...PAYMENT_METHODS]).notNullable()

      table.string('payment_reference').unique()
      table.integer('payment_request_id')
      table.string('payfip_id_op').nullable()

      // Preuve de possession pour le suivi citoyen (statut, paiement,
      // annulation, attestation) — générée dès la création, y compris pour
      // une inscription en liste d'attente.
      table.string('access_token').nullable()

      table.integer('retry_count').notNullable().defaultTo(0)

      // Rejet de justificatifs (maquette) : motif cité tel quel côté
      // citoyen + date limite de re-dépôt avant libération de la place.
      table.text('rejection_reason').nullable()
      table.timestamp('document_deadline_at').nullable()

      // Liste d'attente (maquette).
      table.integer('waitlist_position').nullable()
      table.timestamp('waitlist_notified_at').nullable()
      table.timestamp('waitlist_response_deadline').nullable()

      table.integer('reviewed_by').nullable()
      table.string('reviewed_by_label').nullable()
      table.timestamp('reviewed_at').nullable()

      table.timestamp('otp_verified_at').nullable()
      table.timestamp('cancelled_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
