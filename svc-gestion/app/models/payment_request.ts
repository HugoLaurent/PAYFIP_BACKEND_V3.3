import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import PaymentResolutionAttempt from '#models/payment_resolution_attempt'
import WebhookDelivery from '#models/webhook_delivery'
import { SOURCE_SERVICES, PAYMENT_REQUEST_STATUSES } from '#database/enums'

export type SourceService = (typeof SOURCE_SERVICES)[number]

export type PaymentRequestStatus = (typeof PAYMENT_REQUEST_STATUSES)[number]

export default class PaymentRequest extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare orgId: string

  @column()
  declare sourceService: SourceService

  @column()
  declare sourceReference: string

  @column()
  declare serviceId: number | null

  @column()
  declare exer: number | null

  @column()
  declare payerEmail: string | null

  @column()
  declare numcli: string | null

  @column()
  declare amountCents: number

  @column()
  declare status: PaymentRequestStatus

  @column()
  declare payfipIdOp: string | null

  @column()
  declare frontRedirectUrl: string

  @column()
  declare webhookUrl: string

  @column()
  declare retryOfPaymentRequestId: number | null

  @column.dateTime()
  declare paidAt: DateTime | null

  @column.dateTime()
  declare expiresAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => PaymentResolutionAttempt)
  declare resolutionAttempts: HasMany<typeof PaymentResolutionAttempt>

  @hasMany(() => WebhookDelivery)
  declare webhookDeliveries: HasMany<typeof WebhookDelivery>

  static readonly finalStatuses: PaymentRequestStatus[] = ['paid', 'failed', 'cancelled', 'expired']

  static readonly finalFailureStatuses: PaymentRequestStatus[] = ['failed', 'cancelled', 'expired']

  get isFinal(): boolean {
    return PaymentRequest.finalStatuses.includes(this.status)
  }
}
