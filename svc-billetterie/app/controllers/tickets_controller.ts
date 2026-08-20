import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Ticket from '#models/ticket'
import Scan, { type ScanResult } from '#models/scan'
import { scanTicketValidator, listScansValidator } from '#validators/scan_ticket'
import { decodeTicketCode } from '#services/ticket_code_service'
import { agentLabel } from '#services/agent_label_service'

export default class TicketsController {
  async scan(ctx: HttpContext) {
    const { code } = await ctx.request.validateUsing(scanTicketValidator)
    const { orgId, sub, role, servicePermissions, serviceIds } = ctx.internalAuth

    if (!sub) {
      return ctx.response.status(403).send({ error: 'agent_id_missing_in_token' })
    }
    const agentId = Number(sub)
    const label = agentLabel(ctx.internalAuth)

    const ticketId = decodeTicketCode(code)

    if (!ticketId) {
      await logScan(null, null, Number(orgId), agentId, label, 'invalid_signature', 'code illisible ou forgé')
      return ctx.response.status(422).send({ result: 'invalid_signature' })
    }

    const ticket = await Ticket.find(ticketId)

    if (!ticket || String(ticket.orgId) !== orgId) {
      await logScan(null, null, Number(orgId), agentId, label, 'not_found', null)
      return ctx.response.status(404).send({ result: 'not_found' })
    }

    if (!serviceIds?.includes(ticket.serviceId)) {
      await logScan(
        ticket.id,
        ticket.serviceId,
        ticket.orgId,
        agentId,
        label,
        'other',
        'service_not_allowed_for_agent'
      )
      return ctx.response.status(403).send({ result: 'other', reason: 'service_not_allowed_for_agent' })
    }

    if (role !== 'admin' && !servicePermissions?.[String(ticket.serviceId)]?.canScan) {
      await logScan(ticket.id, ticket.serviceId, ticket.orgId, agentId, label, 'other', 'permission_required')
      return ctx.response.status(403).send({ result: 'other', reason: 'permission_required' })
    }

    if (ticket.status === 'consumed') {
      await logScan(ticket.id, ticket.serviceId, ticket.orgId, agentId, label, 'already_consumed', null)
      return ctx.response.status(409).send({
        result: 'already_consumed',
        ticket: { id: ticket.id, tariffType: ticket.tariffType, visitDate: ticket.visitDate.toISODate() },
      })
    }

    if (ticket.status !== 'issued') {
      await logScan(
        ticket.id,
        ticket.serviceId,
        ticket.orgId,
        agentId,
        label,
        'other',
        `statut: ${ticket.status}`
      )
      return ctx.response.status(409).send({ result: 'other', ticketStatus: ticket.status })
    }

    if (ticket.visitDate.toISODate() !== DateTime.now().toISODate()) {
      await logScan(ticket.id, ticket.serviceId, ticket.orgId, agentId, label, 'invalid_date', null)
      return ctx.response
        .status(409)
        .send({ result: 'invalid_date', visitDate: ticket.visitDate.toISODate() })
    }

    // Transition atomique : sans ça, deux scans simultanés du même billet
    // pourraient tous deux lire status === 'issued' au-dessus et tous deux
    // passer. Un seul UPDATE...WHERE...RETURNING gagne, quel que soit le
    // nombre d'appels concurrents (même pattern que resolvePayment côté
    // svc-gestion).
    const rows = await db
      .from('tickets')
      .where('id', ticket.id)
      .where('status', 'issued')
      .update(
        {
          status: 'consumed',
          consumed_at: DateTime.now().toSQL(),
          consumed_by: agentId,
          consumed_by_label: label,
          updated_at: DateTime.now().toSQL(),
        },
        ['*']
      )

    if (rows.length === 0) {
      await logScan(ticket.id, ticket.serviceId, ticket.orgId, agentId, label, 'already_consumed', null)
      return ctx.response.status(409).send({
        result: 'already_consumed',
        ticket: { id: ticket.id, tariffType: ticket.tariffType, visitDate: ticket.visitDate.toISODate() },
      })
    }

    await logScan(ticket.id, ticket.serviceId, ticket.orgId, agentId, label, 'valid', null)

    return ctx.response.send({
      result: 'valid',
      ticket: {
        id: ticket.id,
        tariffType: ticket.tariffType,
        visitDate: ticket.visitDate.toISODate(),
      },
    })
  }

  /**
   * POST /tickets/:id/reset-scan — remet un billet déjà scanné en
   * "valide", pour une re-entrée légitime (le visiteur ressort chercher
   * quelque chose et revient). Même droit que le scan lui-même : un
   * agent qui peut scanner peut corriger son propre scan.
   */
  async resetScan(ctx: HttpContext) {
    const { orgId, role, servicePermissions, serviceIds, sub } = ctx.internalAuth

    if (!sub) {
      return ctx.response.status(403).send({ error: 'agent_id_missing_in_token' })
    }
    const agentId = Number(sub)
    const label = agentLabel(ctx.internalAuth)

    const ticket = await Ticket.query()
      .where('id', Number(ctx.params.id))
      .where('orgId', orgId)
      .first()

    if (!ticket) {
      return ctx.response.status(404).send({ error: 'ticket_not_found' })
    }

    if (!serviceIds?.includes(ticket.serviceId)) {
      return ctx.response.status(403).send({ error: 'service_not_allowed_for_agent' })
    }

    if (role !== 'admin' && !servicePermissions?.[String(ticket.serviceId)]?.canScan) {
      return ctx.response.status(403).send({ error: 'permission_required' })
    }

    if (ticket.status !== 'consumed') {
      return ctx.response.status(409).send({ error: 'ticket_not_consumed' })
    }

    await db
      .from('tickets')
      .where('id', ticket.id)
      .where('status', 'consumed')
      .update({
        status: 'issued',
        consumed_at: null,
        consumed_by: null,
        consumed_by_label: null,
        updated_at: DateTime.now().toSQL(),
      })

    await logScan(ticket.id, ticket.serviceId, ticket.orgId, agentId, label, 'reset', null)

    return ctx.response.send({
      data: { id: ticket.id, tariffType: ticket.tariffType, visitDate: ticket.visitDate.toISODate() },
    })
  }

  /**
   * GET /scans — historique des scans (valides ou non) pour le service
   * courant, le plus récent en premier. Sert deux usages : la liste
   * courte "Derniers scans" sur l'écran Scanner (canScan suffit), et le
   * vrai historique consultable par un admin/agent avec canViewHistory
   * — qui a scanné, quand, et pourquoi un scan a été refusé.
   */
  async index(ctx: HttpContext) {
    const { serviceId, dateFrom, dateTo, mine, page, perPage } =
      await ctx.request.validateUsing(listScansValidator)
    const { orgId, role, servicePermissions, sub } = ctx.internalAuth

    const perms = servicePermissions?.[String(serviceId)]
    if (role !== 'admin' && !perms?.canScan && !perms?.canViewHistory) {
      return ctx.response.status(403).send({ error: 'permission_required' })
    }

    const query = Scan.query()
      .where('orgId', orgId)
      .where('serviceId', serviceId)
      .preload('ticket', (q) => q.preload('order'))
      .orderBy('createdAt', 'desc')

    if (dateFrom) query.where('createdAt', '>=', dateFrom.toJSDate())
    if (dateTo) query.where('createdAt', '<=', dateTo.plus({ days: 1 }).toJSDate())
    if (mine && sub) query.where('agentId', Number(sub))

    const scans = await query.paginate(page ?? 1, perPage ?? 20)

    return ctx.response.send({
      data: scans.all().map((s) => ({
        id: s.id,
        result: s.result,
        reason: s.reason,
        agentLabel: s.agentLabel,
        tariffType: s.ticket?.tariffType ?? null,
        email: s.ticket?.order?.email ?? null,
        paymentReference: s.ticket?.order?.paymentReference ?? null,
        createdAt: s.createdAt.toISO(),
      })),
      meta: scans.getMeta(),
    })
  }
}

async function logScan(
  ticketId: number | null,
  serviceId: number | null,
  orgId: number,
  agentId: number,
  agentLabelValue: string | null,
  result: ScanResult,
  reason: string | null
) {
  await Scan.create({
    ticketId,
    serviceId,
    orgId,
    agentId,
    agentLabel: agentLabelValue,
    result,
    reason,
  })
}
