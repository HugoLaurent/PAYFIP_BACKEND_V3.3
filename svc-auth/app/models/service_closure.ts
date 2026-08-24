import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Service from '#models/service'

export default class ServiceClosure extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare serviceId: number

  @column()
  declare label: string

  @column.date()
  declare startDate: DateTime

  @column.date()
  declare endDate: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Service)
  declare service: BelongsTo<typeof Service>
}
