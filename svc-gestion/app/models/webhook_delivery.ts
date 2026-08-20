import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import PaymentRequest from '#models/payment_request'
import { WEBHOOK_EVENT_TYPES, WEBHOOK_DELIVERY_STATUSES } from '#database/enums'

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number]
export type WebhookDeliveryStatus = (typeof WEBHOOK_DELIVERY_STATUSES)[number]

export default class WebhookDelivery extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare paymentRequestId: number

  @column()
  declare eventType: WebhookEventType

  @column()
  declare targetUrl: string

  @column({
    prepare: (value: unknown) => JSON.stringify(value),
  })
  declare payload: Record<string, unknown>

  @column()
  declare status: WebhookDeliveryStatus

  @column()
  declare attempts: number

  @column.dateTime()
  declare nextRetryAt: DateTime | null

  @column.dateTime()
  declare deliveredAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => PaymentRequest)
  declare paymentRequest: BelongsTo<typeof PaymentRequest>
}
