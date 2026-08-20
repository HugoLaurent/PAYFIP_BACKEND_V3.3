import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Service from '#models/service'

export default class UserServiceAssignment extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare serviceId: number

  @column.dateTime()
  declare assignedAt: DateTime

  @column()
  declare canSell: boolean

  @column()
  declare canScan: boolean

  @column()
  declare canManageTariffs: boolean

  @column()
  declare canViewHistory: boolean

  @column()
  declare canToggleService: boolean

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Service)
  declare service: BelongsTo<typeof Service>
}
