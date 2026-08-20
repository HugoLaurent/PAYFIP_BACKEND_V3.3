import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Organization from '#models/organization'
import { SERVICE_TYPES, SERVICE_STATUSES, SAISIE_MODES } from '#database/enums'

export type ServiceType = (typeof SERVICE_TYPES)[number]
export type ServiceStatus = (typeof SERVICE_STATUSES)[number]
export type SaisieMode = (typeof SAISIE_MODES)[number]

export default class Service extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare orgId: number

  @column()
  declare name: string

  @column()
  declare serviceType: ServiceType

  @column()
  declare status: ServiceStatus

  @column()
  declare numcli: string | null

  @column()
  declare saisieMode: SaisieMode

  @column()
  declare slug: string | null

  @column({ serializeAs: null })
  declare logoData: Buffer | null

  @column()
  declare logoMimeType: string | null

  @column.dateTime()
  declare logoUpdatedAt: DateTime | null

  @column({ serializeAs: null })
  declare coverImageData: Buffer | null

  @column()
  declare coverImageMimeType: string | null

  @column.dateTime()
  declare coverImageUpdatedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>
}
