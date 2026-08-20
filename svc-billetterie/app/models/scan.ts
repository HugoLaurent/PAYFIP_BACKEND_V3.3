import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Ticket from '#models/ticket'
import { SCAN_RESULTS } from '#database/enums'

export type ScanResult = (typeof SCAN_RESULTS)[number]

export default class Scan extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare ticketId: number | null

  @column()
  declare orgId: number

  @column()
  declare serviceId: number | null

  @column()
  declare agentId: number

  @column()
  declare agentLabel: string | null

  @column()
  declare result: ScanResult

  @column()
  declare reason: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => Ticket)
  declare ticket: BelongsTo<typeof Ticket>
}
