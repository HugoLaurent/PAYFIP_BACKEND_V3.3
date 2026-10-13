import { DateTime } from 'luxon'
import { column } from '@adonisjs/lucid/orm'
import TenantBaseModel from '#models/tenant_base_model'

// Une seule ligne par base de service (id 1) — voir la migration
// create_service_settings_table. Jamais exposé côté citoyen : l'adresse de
// l'agent qui reçoit les pièces reste interne.
export default class ServiceSettings extends TenantBaseModel {
  static table = 'service_settings'

  @column({ isPrimary: true })
  declare id: number

  // Boîte de l'agent qui reçoit les pièces justificatives par email.
  @column()
  declare documentContactEmail: string | null

  // Copies (CC) de ces emails — par ex. un second agent.
  @column({
    prepare: (value: string[] | null) => (value && value.length > 0 ? JSON.stringify(value) : null),
  })
  declare documentContactCc: string[] | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
