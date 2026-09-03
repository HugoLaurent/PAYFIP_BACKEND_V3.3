import { BaseSchema } from '@adonisjs/lucid/schema'
import { TENANT_DB_STATUSES } from '#database/enums'

export default class extends BaseSchema {
  protected tableName = 'tenant_databases'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('service_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('services')
        .onDelete('CASCADE')
        .index()

      // string ordinaire comme service_type sur `services` : un futur
      // app_name (nouveau microservice splitté) n'exige plus de migration.
      table.string('app_name').notNullable()

      // Dénormalisés depuis `services` : évite un join à chaque
      // résolution d'annuaire, qui est déjà appelée à chaud par 4 services.
      table.integer('org_id').unsigned().notNullable().index()
      table.string('service_type').notNullable()

      table.string('db_host').notNullable()
      table.integer('db_port').notNullable()
      table.string('db_name').notNullable()
      table.string('db_user').notNullable()
      // AES-256-GCM : base64(iv|authTag|ciphertext) — voir
      // tenant_credentials_service.ts. Jamais en clair au repos.
      table.text('db_password_enc').notNullable()

      table.enum('status', [...TENANT_DB_STATUSES]).notNullable().defaultTo('provisioning')
      table.integer('last_migration_batch').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      // Un service métier a au plus une base par appli qui le sert (F1 —
      // voir le plan de migration DB-per-tenant).
      table.unique(['service_id', 'app_name'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
