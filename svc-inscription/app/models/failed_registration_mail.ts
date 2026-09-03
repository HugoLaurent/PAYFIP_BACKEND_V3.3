import { DateTime } from 'luxon'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Registration from '#models/registration'
import TenantBaseModel from '#models/tenant_base_model'
import { FAILED_REGISTRATION_MAIL_KINDS } from '#database/enums'

export type FailedRegistrationMailKind = (typeof FAILED_REGISTRATION_MAIL_KINDS)[number]

export default class FailedRegistrationMail extends TenantBaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare registrationId: number

  @column()
  declare mailKind: FailedRegistrationMailKind

  @column()
  declare attempts: number

  @column.dateTime()
  declare nextRetryAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Registration)
  declare registration: BelongsTo<typeof Registration>
}
