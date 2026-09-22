import { DateTime } from 'luxon'
import { column } from '@adonisjs/lucid/orm'
import TenantBaseModel from '#models/tenant_base_model'

// Vivait jusqu'ici sur BaseModel (base centrale, voir tenant_base_model.ts)
// : ne suffisait plus depuis que resolveByLinkCode donne un serviceId
// fiable au moment du dépôt — bascule en tenant pour une isolation
// physique, cohérente avec Tariff/Ticket/Order plutôt qu'un simple filtre
// applicatif sur une table partagée entre tous les organismes.
export default class BudgetCode extends TenantBaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare orgId: number

  // Service précis auquel ce code budgétaire est destiné — résolu via
  // link_code au moment du dépôt (voir aregie_controller.ts#deposit).
  // Nullable pour les lignes déposées avant ce champ, jamais réutilisées
  // par listBudgetCodes()/store() (filtrées par serviceId).
  @column()
  declare serviceId: number | null

  @column()
  declare numcli: string

  @column()
  declare code: string

  @column()
  declare label: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
