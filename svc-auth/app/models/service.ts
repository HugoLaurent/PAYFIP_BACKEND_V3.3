import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Organization from '#models/organization'
import ServiceClosure from '#models/service_closure'
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

  // Les trois nullable ensemble : pas d'horaires configurés = toujours
  // ouvert (voir service_availability_service.ts). openingDays en jours
  // ISO (1 = lundi ... 7 = dimanche), heures en "HH:mm" — un simple
  // varchar plutôt qu'un type `time` Postgres, pas besoin de plus pour
  // comparer deux horaires dans la journée.
  @column()
  declare openingDays: number[] | null

  @column()
  declare openingStartTime: string | null

  @column()
  declare openingEndTime: string | null

  // Message libre affiché aux usagers à la place du texte générique quand
  // l'organisme ferme le service manuellement (status !== 'active') — voir
  // ServicesController#lookupBySlug. Sans rapport avec le `label` d'une
  // période de fermeture programmée (service_closures).
  @column()
  declare closedMessage: string | null

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

  @belongsTo(() => Organization, { foreignKey: 'orgId' })
  declare organization: BelongsTo<typeof Organization>

  @hasMany(() => ServiceClosure)
  declare closures: HasMany<typeof ServiceClosure>
}
