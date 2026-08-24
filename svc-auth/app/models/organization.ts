import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import { ORGANIZATION_STATUSES } from '#database/enums'

export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number]

export default class Organization extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare domain: string

  @column()
  declare status: OrganizationStatus

  // Posés ensemble à la suspension (voir OrganizationsController#update),
  // vidés à la réactivation — même logique que Service#closedMessage,
  // mais ici le message reste interne (staff), jamais montré au citoyen.
  @column.dateTime()
  declare suspendedAt: DateTime | null

  @column()
  declare suspendedMessage: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => User)
  declare users: HasMany<typeof User>
}
