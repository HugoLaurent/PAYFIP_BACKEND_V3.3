import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Registration from '#models/registration'
import { EVENT_TYPES, EVENT_STATUSES, FORM_FIELD_TYPES } from '#database/enums'

export type EventType = (typeof EVENT_TYPES)[number]
export type EventStatus = (typeof EVENT_STATUSES)[number]
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number]

export interface FormField {
  key: string
  label: string
  type: FormFieldType
  required: boolean
  // Uniquement pour type === 'choice' (boutons si <=3 options, menu
  // déroulant au-delà — décision d'affichage laissée au front).
  options?: string[]
}

export default class Event extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare orgId: number

  @column()
  declare serviceId: number

  @column()
  declare type: EventType

  @column()
  declare title: string

  @column()
  declare slug: string

  @column()
  declare description: string | null

  @column.date()
  declare eventDate: DateTime | null

  // "HH:mm" — pour l'export calendrier uniquement, voir migration.
  @column()
  declare startTime: string | null

  @column()
  declare endTime: string | null

  // Libellé libre (ex. "9h–17h"), lieu, catégorie — texte affiché tel
  // quel côté citoyen, pas de logique métier dessus (voir migration).
  @column()
  declare timeLabel: string | null

  @column()
  declare location: string | null

  @column()
  declare category: string | null

  @column.dateTime()
  declare registrationDeadline: DateTime | null

  @column()
  declare priceCents: number

  @column()
  declare requiresDocuments: boolean

  @column()
  declare documentInstructions: string | null

  // null = illimité, voir capacity_service.ts.
  @column()
  declare capacity: number | null

  @column()
  declare maxParticipantsPerRegistration: number

  @column({
    prepare: (value: FormField[] | null) => (value ? JSON.stringify(value) : null),
  })
  declare formSchema: FormField[] | null

  @column()
  declare status: EventStatus

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => Registration)
  declare registrations: HasMany<typeof Registration>
}
