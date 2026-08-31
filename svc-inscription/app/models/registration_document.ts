import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Registration from '#models/registration'

export default class RegistrationDocument extends BaseModel {
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
