import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class UserPasswordHistory extends BaseModel {
  // Lucid pluraliserait le nom du modèle en "user_password_histories" —
  // la table créée par la migration s'appelle "user_password_history".
  static table = 'user_password_history'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column({ serializeAs: null })
  declare passwordHash: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
