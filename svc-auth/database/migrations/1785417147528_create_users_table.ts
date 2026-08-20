import { BaseSchema } from '@adonisjs/lucid/schema'
import { USER_ROLES, USER_STATUSES } from '#database/enums'

export default class extends BaseSchema {
  protected tableName = 'users'

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

      table.string('email').notNullable().unique()
      table.string('password_hash').notNullable()
      table.string('first_name', 100).nullable()
      table.string('last_name', 100).nullable()
      table.enum('role', [...USER_ROLES]).notNullable()
      table.enum('status', [...USER_STATUSES]).notNullable().defaultTo('active')
      table.timestamp('last_login_at').nullable()
      // Forcé à true à la création d'un compte et après une réinitialisation
      // par un admin — le mot de passe choisi par quelqu'un d'autre doit
      // être changé dès la première connexion.
      table.boolean('must_change_password').notNullable().defaultTo(false)
      table.timestamp('password_changed_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
