import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { EMAIL_DELIVERY_STATUSES } from '#database/enums'

export type EmailDeliveryStatus = (typeof EMAIL_DELIVERY_STATUSES)[number]

export interface EmailAttachment {
  filename: string
  contentBase64: string
  contentType: string
}

export default class EmailDelivery extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare template: string

  @column()
  declare toEmail: string

  @column({
    prepare: (value: unknown) => JSON.stringify(value),
    consume: (value: string) => JSON.parse(value) as Record<string, unknown>,
  })
  declare data: Record<string, unknown>

  @column({
    prepare: (value: EmailAttachment[] | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | null) => (value ? (JSON.parse(value) as EmailAttachment[]) : null),
  })
  declare attachments: EmailAttachment[] | null

  @column()
  declare status: EmailDeliveryStatus

  @column()
  declare attempts: number

  @column()
  declare error: string | null

  @column.dateTime()
  declare nextRetryAt: DateTime | null

  @column.dateTime()
  declare sentAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
