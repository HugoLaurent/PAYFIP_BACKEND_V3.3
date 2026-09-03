import { DateTime } from 'luxon'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Registration from '#models/registration'
import TenantBaseModel from '#models/tenant_base_model'

export default class RegistrationDocument extends TenantBaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare registrationId: number

  // Rattache ce fichier à une exigence précise de l'évènement (voir
  // Event.documentRequirements) — jamais un dépôt générique non identifié.
  @column()
  declare documentKey: string

  @column()
  declare filename: string

  @column()
  declare mimeType: string

  // Jamais sérialisé en JSON — même discipline que logoData côté svc-auth.
  @column({ serializeAs: null })
  declare fileData: Buffer

  @column()
  declare sizeBytes: number

  @column()
  declare isCurrent: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => Registration)
  declare registration: BelongsTo<typeof Registration>
}
