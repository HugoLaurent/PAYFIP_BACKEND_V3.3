import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class OtpCode extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare code: string

  @column.dateTime()
  declare expiresAt: DateTime

  @column.dateTime()
  declare verifiedAt: DateTime | null

  @column()
  declare attempts: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
