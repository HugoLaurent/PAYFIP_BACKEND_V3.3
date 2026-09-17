import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class AregieMailSetting extends BaseModel {
  static table = 'aregie_mail_settings'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare apiKeyEncrypted: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
