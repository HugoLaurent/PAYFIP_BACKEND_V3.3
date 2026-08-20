import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Order from '#models/order'
import Scan from '#models/scan'
import { TICKET_STATUSES } from '#database/enums'

export type TicketStatus = (typeof TICKET_STATUSES)[number]

export default class Ticket extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare orderId: number

  @column()
  declare orgId: number

  @column()
  declare serviceId: number

  @column()
  declare tariffType: string

  @column()
  declare priceAtPurchaseCents: number

  @column.date()
  declare visitDate: DateTime

  @column()
  declare status: TicketStatus

  @column.dateTime()
  declare consumedAt: DateTime | null

  @column()
  declare consumedBy: number | null

  @column()
  declare consumedByLabel: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Order)
  declare order: BelongsTo<typeof Order>

  @hasMany(() => Scan)
  declare scans: HasMany<typeof Scan>
}
