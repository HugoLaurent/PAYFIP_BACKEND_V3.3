import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class BudgetCode extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare orgId: number

  // Service précis auquel ce code budgétaire est destiné — résolu via
  // link_code au moment du dépôt (voir aregie_controller.ts#deposit).
  // Nullable pour les lignes déposées avant ce champ, jamais réutilisées
  // par listBudgetCodes()/store() (filtrées par serviceId).
  @column()
  declare serviceId: number | null

  @column()
  declare numcli: string

  @column()
  declare code: string

  @column()
  declare label: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
