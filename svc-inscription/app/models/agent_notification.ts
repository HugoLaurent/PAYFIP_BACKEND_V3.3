import { DateTime } from 'luxon'
import { column } from '@adonisjs/lucid/orm'
import TenantBaseModel from '#models/tenant_base_model'
import { AGENT_NOTIFICATION_TYPES } from '#database/enums'

export type AgentNotificationType = (typeof AGENT_NOTIFICATION_TYPES)[number]

export default class AgentNotification extends TenantBaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare orgId: number

  @column()
  declare serviceId: number

  @column()
  declare eventId: number

  @column()
  declare registrationId: number

  @column()
  declare type: AgentNotificationType

  @column()
  declare citizenName: string

  @column()
  declare eventTitle: string

  @column.dateTime()
  declare readAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
