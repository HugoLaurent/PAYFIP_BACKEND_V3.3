import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Event from '#models/event'
import RegistrationDocument from '#models/registration_document'
import { REGISTRATION_STATUSES, PAYMENT_METHODS } from '#database/enums'

export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number]
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export default class Registration extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare orgId: number

  @column()
  declare serviceId: number

  @column()
  declare eventId: number

  @column()
  declare firstName: string

  @column()
  declare lastName: string

  @column()
  declare email: string

  @column()
  declare quantity: number

  @column({
    prepare: (value: Record<string, unknown> | null) => (value ? JSON.stringify(value) : null),
  })
  declare formResponses: Record<string, unknown> | null

  @column()
  declare status: RegistrationStatus

  @column()
  declare priceCentsAtRegistration: number

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
  declare rejectionReason: string | null

  @column.dateTime()
  declare documentDeadlineAt: DateTime | null

  // true seulement après une demande de "document supplémentaire" (pas un
  // vrai rejet) — indique à replaceDocuments() de ne pas invalider les
  // documents déjà déposés, voir registrations_controller.ts#review.
  @column()
  declare keepExistingDocuments: boolean

  @column()
  declare waitlistPosition: number | null

  @column.dateTime()
  declare waitlistNotifiedAt: DateTime | null

  @column.dateTime()
  declare waitlistResponseDeadline: DateTime | null

  @column()
  declare reviewedBy: number | null

  @column()
  declare reviewedByLabel: string | null

  @column.dateTime()
  declare reviewedAt: DateTime | null

  @column.dateTime()
  declare otpVerifiedAt: DateTime | null

  @column.dateTime()
  declare cancelledAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Event)
  declare event: BelongsTo<typeof Event>

  @hasMany(() => RegistrationDocument)
  declare documents: HasMany<typeof RegistrationDocument>
}
