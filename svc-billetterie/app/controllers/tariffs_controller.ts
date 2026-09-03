import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import Tariff from '#models/tariff'
import BudgetCode from '#models/budget_code'
import {
  createTariffValidator,
  listBudgetCodesValidator,
  updateTariffValidator,
} from '#validators/tariff'
import { runOnTenant, ensureTenantConnections } from '#services/tenant_connection_service'

const queryValidator = vine.compile(
  vine.object({
    serviceId: vine.number().positive(),
    includeArchived: vine.boolean().optional(),
  })
)

// L'id de tarif seul ne dit pas quel service — fan-out borné aux
// serviceIds de l'agent (déjà connus du JWT), jamais l'annuaire entier
// (même raisonnement que findTicketInOrg dans tickets_controller.ts).
// serviceIds vient du JWT tous types de service confondus (un agent peut
// avoir accès à des services billetterie ET inscription) — ensureTenant
// Connections ignore silencieusement ceux qui ne sont pas des services
// billetterie, jamais une erreur. orgId revérifié explicitement en plus :
// un tarif dont la ligne ne correspondrait pas à l'organisme attendu ne
// doit jamais passer, même si la connexion tenant elle-même est correcte.
async function findTariffForAgent(
  orgId: string,
  serviceIds: number[],
  tariffId: number
): Promise<Tariff | null> {
  const billetterieServiceIds = await ensureTenantConnections(serviceIds)
  for (const serviceId of billetterieServiceIds) {
    const tariff = await runOnTenant(serviceId, () => Tariff.find(tariffId))
    if (tariff && String(tariff.orgId) === orgId) return tariff
  }
  return null
}

export default class TariffsController {
  async listBudgetCodes(ctx: HttpContext) {
    const { orgId, role, servicePermissions, serviceIds } = ctx.internalAuth
    const { numcli, serviceId } = await ctx.request.validateUsing(listBudgetCodesValidator)

    if (!serviceIds?.includes(serviceId)) {
      return ctx.response.status(403).send({ error: 'service_not_allowed_for_agent' })
    }

    if (role !== 'admin' && !servicePermissions?.[String(serviceId)]?.canManageTariffs) {
      return ctx.response.status(403).send({ error: 'permission_required' })
    }

    // BudgetCode reste app-local (pas de serviceId, unique sur
    // (orgId, numcli, code)) — pas de runOnTenant ici.
    const codes = await BudgetCode.query()
      .where('orgId', Number(orgId))
      .where('numcli', numcli)
      .orderBy('code')

    return ctx.response.send({
      data: codes.map((c) => ({ code: c.code, label: c.label })),
    })
  }

  /**
   * GET /tariffs — public (citoyen, jamais authentifié) : toujours actifs
   * seulement. Un admin/agent avec canManageTariffs qui passe
   * includeArchived=true voit aussi les tarifs désactivés, pour pouvoir
   * les réactiver — jamais exposé à un appel public, même avec le
   * paramètre.
   */
  async index(ctx: HttpContext) {
    const { serviceId, includeArchived } = await queryValidator.validate(ctx.request.qs())
    const { orgId, role, servicePermissions } = ctx.internalAuth

    const canManage = role === 'admin' || servicePermissions?.[String(serviceId)]?.canManageTariffs === true

    const tariffs = await runOnTenant(serviceId, () => {
      const query = Tariff.query().where('orgId', Number(orgId)).where('serviceId', serviceId)
      if (!includeArchived || !canManage) {
        query.where('status', 'active')
      }
      return query.orderBy('priceCents', 'desc')
    })

    return ctx.response.send({
      data: tariffs.map((t) => ({
        id: t.id,
        tariffType: t.tariffType,
        priceCents: t.priceCents,
        status: t.status,
      })),
    })
  }

  async store(ctx: HttpContext) {
    const { orgId, role, servicePermissions, serviceIds } = ctx.internalAuth
    const payload = await ctx.request.validateUsing(createTariffValidator)
    const serviceId = Number(ctx.params.id)

    if (!serviceIds?.includes(serviceId)) {
      return ctx.response.status(403).send({ error: 'service_not_allowed_for_agent' })
    }

    if (role !== 'admin' && !servicePermissions?.[String(serviceId)]?.canManageTariffs) {
      return ctx.response.status(403).send({ error: 'permission_required' })
    }

    return runOnTenant(serviceId, async () => {
      const existing = await Tariff.query()
        .where('orgId', orgId)
        .where('serviceId', serviceId)
        .where('tariffType', payload.tariffType)
        .first()

      if (existing) {
        return ctx.response.status(409).send({ error: 'tariff_type_already_exists' })
      }

      // BudgetCode reste app-local — lu hors du contexte tenant, mais
      // l'écriture du Tariff qui le référence, elle, doit rester dans
      // runOnTenant().
      const budgetCode = await BudgetCode.query()
        .where('orgId', Number(orgId))
        .where('numcli', payload.numcli)
        .where('code', payload.budgetCode)
        .first()

      if (!budgetCode) {
        return ctx.response.status(422).send({ error: 'unknown_budget_code' })
      }

      const tariff = await Tariff.create({
        orgId: Number(orgId),
        serviceId,
        tariffType: payload.tariffType,
        priceCents: payload.priceCents,
        budgetCode: budgetCode.code,
        status: 'active',
      })

      return ctx.response.status(201).send({
        data: { tariffType: tariff.tariffType, priceCents: tariff.priceCents, budgetCode: tariff.budgetCode },
      })
    })
  }

  async update(ctx: HttpContext) {
    const { orgId, role, servicePermissions, serviceIds } = ctx.internalAuth

    if (!serviceIds) {
      return ctx.response.status(403).send({ error: 'service_not_allowed_for_agent' })
    }

    const tariff = await findTariffForAgent(orgId, serviceIds, Number(ctx.params.id))
    if (!tariff) {
      return ctx.response.status(404).send({ error: 'tariff_not_found' })
    }

    if (role !== 'admin' && !servicePermissions?.[String(tariff.serviceId)]?.canManageTariffs) {
      return ctx.response.status(403).send({ error: 'permission_required' })
    }

    const payload = await ctx.request.validateUsing(updateTariffValidator)

    return runOnTenant(tariff.serviceId, async () => {
      if (payload.priceCents !== undefined) tariff.priceCents = payload.priceCents
      if (payload.status !== undefined) tariff.status = payload.status
      await tariff.save()

      return ctx.response.send({
        data: {
          id: tariff.id,
          tariffType: tariff.tariffType,
          priceCents: tariff.priceCents,
          status: tariff.status,
        },
      })
    })
  }

  /**
   * DELETE /tariffs/:id — suppression définitive, réservée à un tarif
   * déjà désactivé (jamais un tarif encore actif, qu'un citoyen pourrait
   * être en train d'acheter). Les commandes passées gardent leur propre
   * copie du type/prix (OrderLine ne référence pas Tariff par clé
   * étrangère), donc supprimer la ligne de référentiel ne touche jamais
   * l'historique.
   */
  async destroy(ctx: HttpContext) {
    const { orgId, role, servicePermissions, serviceIds } = ctx.internalAuth

    if (!serviceIds) {
      return ctx.response.status(403).send({ error: 'service_not_allowed_for_agent' })
    }

    const tariff = await findTariffForAgent(orgId, serviceIds, Number(ctx.params.id))
    if (!tariff) {
      return ctx.response.status(404).send({ error: 'tariff_not_found' })
    }

    if (role !== 'admin' && !servicePermissions?.[String(tariff.serviceId)]?.canManageTariffs) {
      return ctx.response.status(403).send({ error: 'permission_required' })
    }

    if (tariff.status !== 'archived') {
      return ctx.response.status(409).send({ error: 'tariff_must_be_archived_first' })
    }

    return runOnTenant(tariff.serviceId, async () => {
      await tariff.delete()
      return ctx.response.status(204).send('')
    })
  }
}
