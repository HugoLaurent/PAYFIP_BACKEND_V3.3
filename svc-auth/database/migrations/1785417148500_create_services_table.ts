import { BaseSchema } from '@adonisjs/lucid/schema'
import { SERVICE_STATUSES, SAISIE_MODES } from '#database/enums'

export default class extends BaseSchema {
  protected tableName = 'services'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('org_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('organizations')
        .onDelete('CASCADE')
        .index()

      table.string('name').notNullable()
      // string ordinaire, pas de CHECK Postgres : validé uniquement côté
      // TS (SERVICE_TYPES + validators/service.ts) pour qu'un futur type
      // de service n'exige plus jamais de migration.
      table.string('service_type').notNullable()
      table.enum('status', [...SERVICE_STATUSES]).notNullable().defaultTo('draft')

      table.string('numcli', 6).nullable()
      table.enum('saisie_mode', [...SAISIE_MODES]).notNullable().defaultTo('T')

      table.string('slug').nullable().unique()

      table.binary('logo_data').nullable()
      table.string('logo_mime_type', 100).nullable()
      table.timestamp('logo_updated_at').nullable()

      table.binary('cover_image_data').nullable()
      table.string('cover_image_mime_type', 100).nullable()
      table.timestamp('cover_image_updated_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
