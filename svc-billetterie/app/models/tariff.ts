import { DateTime } from 'luxon'
import { BaseModel, column, scope } from '@adonisjs/lucid/orm'
import { TARIFF_STATUSES } from '#database/enums'

export type TariffStatus = (typeof TARIFF_STATUSES)[number]

export default class Tariff extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare orgId: number

  @column()
  declare serviceId: number

  @column()
  declare tariffType: string

  @column()
  declare priceCents: number

  @column()
  declare status: TariffStatus

  @column()
  declare budgetCode: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  static active = scope((query, orgId: number, serviceId: number) => {
    query.where('orgId', orgId).where('serviceId', serviceId).where('status', 'active')
  })
}
