
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export class PaymentRequestSchema extends BaseModel {
  static $columns = ['amountCents', 'createdAt', 'exer', 'expiresAt', 'frontRedirectUrl', 'id', 'numcli', 'orgId', 'paidAt', 'payerEmail', 'payfipIdOp', 'retryOfPaymentRequestId', 'serviceId', 'sourceReference', 'sourceService', 'status', 'updatedAt', 'webhookUrl'] as const
  $columns = PaymentRequestSchema.$columns
  @column()
  declare amountCents: number
  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
  @column()
  declare exer: number | null
  @column.dateTime()
  declare expiresAt: DateTime | null
  @column()
  declare frontRedirectUrl: string
  @column({ isPrimary: true })
  declare id: number
  @column()
  declare numcli: string | null
  @column()
  declare orgId: string
  @column.dateTime()
  declare paidAt: DateTime | null
  @column()
  declare payerEmail: string | null
  @column()
  declare payfipIdOp: string | null
  @column()
  declare retryOfPaymentRequestId: number | null
  @column()
  declare serviceId: number | null
  @column()
  declare sourceReference: string
  @column()
  declare sourceService: string
  @column()
  declare status: string
  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
  @column()
  declare webhookUrl: string
}

export class PaymentResolutionAttemptSchema extends BaseModel {
  static $columns = ['calledAt', 'id', 'payfipResultCode', 'paymentRequestId', 'rawResponse', 'resultingStatus', 'trigger'] as const
  $columns = PaymentResolutionAttemptSchema.$columns
  @column.dateTime()
  declare calledAt: DateTime
  @column({ isPrimary: true })
  declare id: number
  @column()
  declare payfipResultCode: string | null
  @column()
  declare paymentRequestId: number
  @column()
  declare rawResponse: any | null
  @column()
  declare resultingStatus: string
  @column()
  declare trigger: string
}

export class WebhookDeliverySchema extends BaseModel {
  static $columns = ['attempts', 'createdAt', 'deliveredAt', 'eventType', 'id', 'nextRetryAt', 'payload', 'paymentRequestId', 'status', 'targetUrl', 'updatedAt'] as const
  $columns = WebhookDeliverySchema.$columns
  @column()
  declare attempts: number
  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
  @column.dateTime()
  declare deliveredAt: DateTime | null
  @column()
  declare eventType: string
  @column({ isPrimary: true })
  declare id: number
  @column.dateTime()
  declare nextRetryAt: DateTime | null
  @column()
  declare payload: any
  @column()
  declare paymentRequestId: number
  @column()
  declare status: string
  @column()
  declare targetUrl: string
  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
