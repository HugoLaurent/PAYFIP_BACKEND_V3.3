import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import PaymentRequest from '#models/payment_request'
import { RESOLUTION_TRIGGERS } from '#database/enums'

export type ResolutionTrigger = (typeof RESOLUTION_TRIGGERS)[number]

export default class PaymentResolutionAttempt extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare paymentRequestId: number

  @column()
  declare trigger: ResolutionTrigger

  @column()
  declare payfipResultCode: string | null

  @column()
  declare resultingStatus: string

  @column({
    prepare: (value: unknown) => (value === undefined ? null : JSON.stringify(value)),
  })
  declare rawResponse: Record<string, unknown> | null

  @column.dateTime()
  declare calledAt: DateTime

  @belongsTo(() => PaymentRequest)
  declare paymentRequest: BelongsTo<typeof PaymentRequest>
}
