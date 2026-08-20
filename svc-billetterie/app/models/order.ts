import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Ticket from '#models/ticket'
import OrderLine from '#models/order_line'
import { ORDER_STATUSES, PAYMENT_METHODS } from '#database/enums'

export type OrderStatus = (typeof ORDER_STATUSES)[number]
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export default class Order extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare orgId: number

  @column()
  declare serviceId: number

  @column()
  declare email: string

  @column.date()
  declare visitDate: DateTime

  @column()
  declare qtyTickets: number

  @column()
  declare totalAmountCents: number

  @column()
  declare status: OrderStatus

  @column()
  declare paymentMethod: PaymentMethod

  @column()
  declare paymentReference: string | null

  @column()
  declare paymentRequestId: number | null

  @column()
  declare payfipIdOp: string | null

  @column()
  declare accessToken: string | null

  @column()
  declare retryCount: number

  @column()
  declare agentId: number | null

  @column()
  declare soldBy: string | null

  @column.dateTime()
  declare otpVerifiedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => Ticket)
  declare tickets: HasMany<typeof Ticket>

  @hasMany(() => OrderLine)
  declare lines: HasMany<typeof OrderLine>
}
