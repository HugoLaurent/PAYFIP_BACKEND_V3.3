import { DateTime } from 'luxon'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Registration from '#models/registration'
import TenantBaseModel from '#models/tenant_base_model'
import { PAYMENT_ATTEMPT_STATUSES } from '#database/enums'

export type PaymentAttemptStatus = (typeof PAYMENT_ATTEMPT_STATUSES)[number]

export default class RegistrationPaymentAttempt extends TenantBaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare registrationId: number

  @column()
  declare paymentRequestId: number

  @column()
  declare status: PaymentAttemptStatus

  @column()
  declare isRetry: boolean

  @column.dateTime()
  declare paidAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Registration)
  declare registration: BelongsTo<typeof Registration>
}
