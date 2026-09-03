import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import TenantDatabase from '#models/tenant_database'
import Service from '#models/service'
import { encryptTenantDbPassword, decryptTenantDbPassword } from '#services/tenant_credentials_service'
import { TENANT_DB_APPS } from '#database/enums'

const upsertValidator = vine.compile(
  vine.object({
    serviceId: vine.number().positive(),
    appName: vine.enum(TENANT_DB_APPS),
    dbHost: vine.string().trim(),
    dbPort: vine.number().positive(),
    dbName: vine.string().trim(),
    dbUser: vine.string().trim(),
    dbPassword: vine.string(),
  })
)

export default class TenantDatabasesController {
  /**
   * GET /tenant-databases/:appName — annuaire des bases tenant d'une appli
   * splittée. Chaque service (billetterie/factures/inscription/gestion)
   * ne peut lister que ses propres bases (scope === appName demandé) —
   * jamais celles d'une autre appli. Appelé une fois au boot puis à
   * intervalle par TenantRegistryClient, jamais par requête HTTP entrante.
   */
  async index(ctx: HttpContext) {
    const appName = ctx.params.appName
    if (ctx.internalAuth.scope !== appName) {
      return ctx.response.status(403).send({ error: 'scope_not_allowed' })
    }

    const rows = await TenantDatabase.query().where('appName', appName).where('status', 'active')

    const data = await Promise.all(
      rows.map(async (row) => ({
        serviceId: row.serviceId,
        orgId: row.orgId,
        serviceType: row.serviceType,
        dbHost: row.dbHost,
        dbPort: row.dbPort,
        dbName: row.dbName,
        dbUser: row.dbUser,
        dbPassword: await decryptTenantDbPassword(row.dbPasswordEnc),
      }))
    )

    return ctx.response.send({ data })
  }

  /**
   * POST /tenant-databases — enregistre/actualise la base tenant d'un
   * service pour une appli donnée (provisioning). Un service ne peut
   * écrire que sous son propre appName — jamais pour le compte d'une
   * autre appli. Upsert sur (serviceId, appName) : rejouable sans risque
   * si la commande de provisioning est relancée après un échec partiel.
   */
  async store(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(upsertValidator)

    if (ctx.internalAuth.scope !== payload.appName) {
      return ctx.response.status(403).send({ error: 'scope_not_allowed' })
    }

    const service = await Service.find(payload.serviceId)
    if (!service) {
      return ctx.response.status(404).send({ error: 'service_not_found' })
    }
    // 'gestion' sert les 3 types de service à la fois (voir F1 du plan de
    // migration DB-per-tenant) — pour les 3 autres appName, appName EST le
    // serviceType attendu.
    if (payload.appName !== 'gestion' && service.serviceType !== payload.appName) {
      return ctx.response.status(422).send({ error: 'service_type_mismatch' })
    }

    const dbPasswordEnc = await encryptTenantDbPassword(payload.dbPassword)

    const row = await TenantDatabase.updateOrCreate(
      { serviceId: payload.serviceId, appName: payload.appName },
      {
        orgId: service.orgId,
        serviceType: service.serviceType,
        dbHost: payload.dbHost,
        dbPort: payload.dbPort,
        dbName: payload.dbName,
        dbUser: payload.dbUser,
        dbPasswordEnc,
        status: 'provisioning',
      }
    )

    return ctx.response.status(201).send({ data: { id: row.id, status: row.status } })
  }

  /**
   * PATCH /tenant-databases/:id/status — bascule le statut une fois les
   * migrations passées (provisioning -> active), ou pour suspendre une
   * base tenant sans la supprimer de l'annuaire.
   */
  async updateStatus(ctx: HttpContext) {
    const row = await TenantDatabase.find(Number(ctx.params.id))
    if (!row) {
      return ctx.response.status(404).send({ error: 'tenant_database_not_found' })
    }

    if (ctx.internalAuth.scope !== row.appName) {
      return ctx.response.status(403).send({ error: 'scope_not_allowed' })
    }

    const { status } = await ctx.request.validateUsing(
      vine.compile(
        vine.object({ status: vine.enum(['provisioning', 'active', 'migrating', 'suspended']) })
      )
    )

    row.status = status
    await row.save()

    return ctx.response.send({ data: { id: row.id, status: row.status } })
  }
}
