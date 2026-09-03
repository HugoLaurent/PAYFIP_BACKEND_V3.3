import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Ticket from '#models/ticket'
import Scan, { type ScanResult } from '#models/scan'
import { scanTicketValidator, listScansValidator } from '#validators/scan_ticket'
import { decodeTicketCode } from '#services/ticket_code_service'
import { encodeOrderCode } from '#services/order_code_service'
import { agentLabel } from '#services/agent_label_service'
import {
  runOnTenant,
  ensureTenantConnectionsForOrg,
  connectionNameFor,
} from '#services/tenant_connection_service'

export default class TicketsController {
  /**
   * POST /tickets/scan — le code embarque désormais le serviceId (voir
   * ticket_code_service.ts) : routage direct dès que le code est
   * déchiffrable. Quand il ne l'est pas (signature invalide) ou que le
   * ticket est introuvable dans la base qu'il désigne, il n'y a
   * structurellement aucun serviceId fiable à router — Scan reste sur la
   * connexion app-locale précisément pour pouvoir tracer ces tentatives
   * (QR forgé/périmé) sans base tenant à choisir.
   */
  async scan(ctx: HttpContext) {
    const { code } = await ctx.request.validateUsing(scanTicketValidator)
    const { orgId, sub, role, servicePermissions, serviceIds } = ctx.internalAuth

    if (!sub) {
      return ctx.response.status(403).send({ error: 'agent_id_missing_in_token' })
    }
    const agentId = Number(sub)
    const label = agentLabel(ctx.internalAuth)

    const decoded = decodeTicketCode(code)

    if (!decoded) {
      await logScan(null, null, Number(orgId), agentId, label, 'invalid_signature', 'code illisible ou forgé')
      return ctx.response.status(422).send({ result: 'invalid_signature' })
    }

    const ticket = await runOnTenant(decoded.serviceId, () => Ticket.find(decoded.ticketId))

    if (!ticket || ticket.serviceId !== decoded.serviceId || String(ticket.orgId) !== orgId) {
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
        orderCode: encodeOrderCode(ticket.serviceId, ticket.orderId),
        consumedAt: ticket.consumedAt?.toISO() ?? null,
        consumedByLabel: ticket.consumedByLabel,
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
      return ctx.response.status(409).send({
        result: 'invalid_date',
        visitDate: ticket.visitDate.toISODate(),
        tariffType: ticket.tariffType,
      })
    }

    // Transition atomique : sans ça, deux scans simultanés du même billet
    // pourraient tous deux lire status === 'issued' au-dessus et tous deux
    // passer. Un seul UPDATE...WHERE...RETURNING gagne, quel que soit le
    // nombre d'appels concurrents (même pattern que resolvePayment côté
    // svc-gestion).
    const rows = await runOnTenant(decoded.serviceId, () =>
      db
        .connection(connectionNameFor(decoded.serviceId))
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
      // Permet au front de proposer directement les autres billets de la
      // même commande (famille/groupe) sans que l'agent ait besoin de
      // scanner un QR de commande séparé — même endpoint /orders/scan
      // que ce code alimente déjà.
      orderCode: encodeOrderCode(ticket.serviceId, ticket.orderId),
    })
  }

  /**
   * POST /tickets/:id/reset-scan — l'id de billet seul ne dit pas quel
   * service : fan-out borné à l'organisme (même périmètre qu'avant le
   * split, qui filtrait par orgId seul).
   */
  async resetScan(ctx: HttpContext) {
    const { orgId, role, servicePermissions, serviceIds, sub } = ctx.internalAuth

    if (!sub) {
      return ctx.response.status(403).send({ error: 'agent_id_missing_in_token' })
    }
    const agentId = Number(sub)
    const label = agentLabel(ctx.internalAuth)

    const ticket = await findTicketInOrg(Number(orgId), Number(ctx.params.id))

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

    await runOnTenant(ticket.serviceId, () =>
      db
        .connection(connectionNameFor(ticket.serviceId))
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
    )

    await logScan(ticket.id, ticket.serviceId, ticket.orgId, agentId, label, 'reset', null)

    return ctx.response.send({
      data: { id: ticket.id, tariffType: ticket.tariffType, visitDate: ticket.visitDate.toISODate() },
    })
  }

  /**
   * GET /scans — Scan reste sur la connexion app-locale (voir
   * tenant_base_model.ts), donc pas de fan-out ici — inchangé, à part le
   * preload('ticket', ...) qui traversait auparavant une seule base et
   * doit maintenant faire un second aller vers la base tenant du service
   * (déjà connu ici, un seul serviceId).
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
      .orderBy('createdAt', 'desc')

    if (dateFrom) query.where('createdAt', '>=', dateFrom.toJSDate())
    if (dateTo) query.where('createdAt', '<=', dateTo.plus({ days: 1 }).toJSDate())
    if (mine && sub) query.where('agentId', Number(sub))

    const scans = await query.paginate(page ?? 1, perPage ?? 20)
    const scanRows = scans.all()

    const ticketIds = [...new Set(scanRows.map((s) => s.ticketId).filter((id): id is number => id !== null))]
    const ticketsById = new Map<number, { tariffType: string; email: string | null; paymentReference: string | null }>()

    if (ticketIds.length > 0) {
      const tickets = await runOnTenant(serviceId, () =>
        Ticket.query().whereIn('id', ticketIds).preload('order')
      )
      for (const t of tickets) {
        ticketsById.set(t.id, {
          tariffType: t.tariffType,
          email: t.order?.email ?? null,
          paymentReference: t.order?.paymentReference ?? null,
        })
      }
    }

    return ctx.response.send({
      data: scanRows.map((s) => {
        const ticketInfo = s.ticketId ? ticketsById.get(s.ticketId) : undefined
        return {
          id: s.id,
          result: s.result,
          reason: s.reason,
          agentLabel: s.agentLabel,
          tariffType: ticketInfo?.tariffType ?? null,
          email: ticketInfo?.email ?? null,
          paymentReference: ticketInfo?.paymentReference ?? null,
          createdAt: s.createdAt.toISO(),
        }
      }),
      meta: scans.getMeta(),
    })
  }
}

async function findTicketInOrg(orgId: number, ticketId: number): Promise<Ticket | null> {
  const serviceIds = await ensureTenantConnectionsForOrg(orgId)
  for (const serviceId of serviceIds) {
    const ticket = await runOnTenant(serviceId, () =>
      Ticket.query().where('id', ticketId).where('orgId', orgId).first()
    )
    if (ticket) return ticket
  }
  return null
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
