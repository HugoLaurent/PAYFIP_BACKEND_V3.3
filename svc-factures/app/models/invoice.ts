import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { INVOICE_STATUSES } from '#database/enums'

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export default class Invoice extends BaseModel {
  static finalStatuses: InvoiceStatus[] = ['confirmed', 'cancelled']

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare orgId: number

  @column()
  declare serviceId: number | null

  @column()
  declare hospitalReference: string

  @column()
  declare amountCents: number

  @column()
  declare objectLabel: string

  @column()
  declare status: InvoiceStatus

  @column()
  declare paymentRequestId: number | null

  @column()
  declare payfipIdOp: string | null

  @column()
  declare paymentReference: string | null

  @column()
  declare clientNumber: string | null

  @column()
  declare fiscalYear: number

  /** Statut de suivi propre à AREGIE — informatif, ne pilote jamais `status`. */
  @column()
  declare aregieStatus: string | null

  @column()
  declare payerEmail: string | null

  @column.dateTime()
  declare depositedAt: DateTime | null

  @column.dateTime()
  declare collectedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
