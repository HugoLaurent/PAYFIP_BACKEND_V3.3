import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Service from '#models/service'
import { TENANT_DB_APPS, TENANT_DB_STATUSES } from '#database/enums'

export type TenantDbApp = (typeof TENANT_DB_APPS)[number]
export type TenantDbStatus = (typeof TENANT_DB_STATUSES)[number]

export default class TenantDatabase extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare serviceId: number

  @column()
  declare appName: TenantDbApp

  @column()
  declare orgId: number

  @column()
  declare serviceType: string

  @column()
  declare dbHost: string

  @column()
  declare dbPort: number

  @column()
  declare dbName: string

  @column()
  declare dbUser: string

  @column({ serializeAs: null })
  declare dbPasswordEnc: string

  @column()
  declare status: TenantDbStatus

  @column()
  declare lastMigrationBatch: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Service)
  declare service: BelongsTo<typeof Service>
}
