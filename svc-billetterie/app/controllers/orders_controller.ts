import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import Order from '#models/order'
import OrderLine from '#models/order_line'
import Ticket from '#models/ticket'
import Scan from '#models/scan'
import OrderPaymentAttempt from '#models/order_payment_attempt'
import {
  createOrderValidator,
  agentSaleValidator,
  listOrdersValidator,
  listOrdersStaffValidator,
  retryOrderPaymentValidator,
  scanOrderValidator,
} from '#validators/order'
import { paymentWebhookValidator } from '#validators/payment_webhook'
import { computeOrderTotals, UnknownTariffTypeError } from '#services/order_pricing_service'
import { isEmailVerified } from '#services/otp_service'
import { createPaymentRequest, retryPaymentRequest, SvcGestionError } from '#services/svc_gestion_client'
import { fetchServiceStatus, isVisitDateInClosure, isVisitDateOpen } from '#services/svc_auth_client'
import { agentLabel } from '#services/agent_label_service'
import { generateTicketsForOrder } from '#services/ticket_generation_service'
import { encodeTicketCode } from '#services/ticket_code_service'
import { decodeOrderCode, encodeOrderCode } from '#services/order_code_service'
import { generateTicketPdf, generateOrderTicketsPdf } from '#services/ticket_pdf_service'
import { sendTicketConfirmationEmail } from '#services/ticket_confirmation_mail_service'
import {
  runOnTenant,
  ensureTenantConnectionsForOrg,
  ensureTenantConnections,
  tenantConnectionStorage,
} from '#services/tenant_connection_service'

// REFDET PayFiP : 6 à 30 caractères alphanumériques sans caractère
// spécial. Le serviceId est embarqué dans la référence elle-même (largeur
// fixe, donc parsable sans ambiguïté) pour que ticketsByReference()/
// retryPayment()/paymentWebhook() routent directement vers la bonne base
// tenant, sans jamais avoir à interroger tous les services d'un
// organisme pour retrouver une commande (même raisonnement que le split
// factures — deux services ont chacun leur séquence d'id repartant de 1,
// un id de commande seul ne suffit plus à être unique globalement).
const REFERENCE_SERVICE_ID_WIDTH = 6
const REFERENCE_ORDER_ID_WIDTH = 8
const PAYMENT_REFERENCE_RE = new RegExp(
  `^BILL(\\d{${REFERENCE_SERVICE_ID_WIDTH}})(\\d{${REFERENCE_ORDER_ID_WIDTH}})$`
)

function buildPaymentReference(serviceId: number, orderId: number): string {
  return `BILL${String(serviceId).padStart(REFERENCE_SERVICE_ID_WIDTH, '0')}${String(
    orderId
  ).padStart(REFERENCE_ORDER_ID_WIDTH, '0')}`
}

function parsePaymentReference(reference: string): { serviceId: number; orderId: number } | null {
  const match = PAYMENT_REFERENCE_RE.exec(reference)
  if (!match) return null
  return { serviceId: Number(match[1]), orderId: Number(match[2]) }
}

function serializeTicket(ticket: Ticket) {
  return {
    id: ticket.id,
    tariffType: ticket.tariffType,
    priceAtPurchaseCents: ticket.priceAtPurchaseCents,
    visitDate: ticket.visitDate.toISODate(),
    status: ticket.status,
    code: encodeTicketCode(ticket.serviceId, ticket.id),
  }
}

export default class OrdersController {
  /**
   * GET /orders/stats — indicateurs du mois en cours, tous services
   * billetterie confondus. Un admin voit tout l'organisme (fan-out sur
   * toutes les bases tenant de l'org) ; un agent seulement les services
   * où il a canViewHistory (fan-out borné à ces services précis). Scan
   * reste sur la connexion app-locale (voir tenant_base_model.ts) — sa
   * partie de la requête ne change pas.
   */
  async stats(ctx: HttpContext) {
    const { orgId, role, servicePermissions, serviceIds } = ctx.internalAuth

    let allowedServiceIds: number[] | null = null
    if (role !== 'admin') {
      allowedServiceIds = (serviceIds ?? []).filter(
        (id) => servicePermissions?.[String(id)]?.canViewHistory
      )
      if (allowedServiceIds.length === 0) {
        return ctx.response.send({
          data: {
            monthRevenueCents: 0,
            monthTicketsSold: 0,
            monthTicketsScanned: 0,
            prevMonthRevenueCents: 0,
            dailyRevenue: [],
            topServices: [],
            recentActivity: [],
          },
        })
      }
    }

    const targetServiceIds = allowedServiceIds
      ? await ensureTenantConnections(allowedServiceIds)
      : await ensureTenantConnectionsForOrg(Number(orgId))

    const monthStart = DateTime.now().startOf('month')
    const prevMonthStart = monthStart.minus({ months: 1 })
    const sparklineStart = DateTime.now().minus({ days: 13 }).startOf('day')
    const queryStart = sparklineStart < prevMonthStart ? sparklineStart : prevMonthStart

    let monthRevenueCents = 0
    let monthTicketsSold = 0
    let prevMonthRevenueCents = 0
    let monthTicketsScanned = 0
    const byService = new Map<number, { revenueCents: number; ticketsSold: number }>()
    const dailyMap = new Map<string, number>()
    const recentOrdersAll: Order[] = []

    for (const serviceId of targetServiceIds) {
      const { orders, scannedCount, recentOrders } = await runOnTenant(serviceId, async () => {
        const orders = await Order.query()
          .where('orgId', orgId)
          .where('status', 'confirmed')
          .where('createdAt', '>=', queryStart.toJSDate())
          .select('serviceId', 'totalAmountCents', 'qtyTickets', 'createdAt')

        const scanStats = await db
          .from('tickets')
          .where('org_id', orgId)
          .where('service_id', serviceId)
          .whereNotNull('consumed_at')
          .where('consumed_at', '>=', monthStart.toSQL()!)
          .count('* as total')
          .first()

        const recentOrders = await Order.query()
          .where('orgId', orgId)
          .where('status', 'confirmed')
          .orderBy('createdAt', 'desc')
          .limit(8)

        return { orders, scannedCount: Number(scanStats?.total ?? 0), recentOrders }
      })

      monthTicketsScanned += scannedCount
      recentOrdersAll.push(...recentOrders)

      for (const o of orders) {
        if (o.createdAt >= monthStart) {
          monthRevenueCents += o.totalAmountCents
          monthTicketsSold += o.qtyTickets
          const entry = byService.get(o.serviceId) ?? { revenueCents: 0, ticketsSold: 0 }
          entry.revenueCents += o.totalAmountCents
          entry.ticketsSold += o.qtyTickets
          byService.set(o.serviceId, entry)
        } else if (o.createdAt >= prevMonthStart) {
          prevMonthRevenueCents += o.totalAmountCents
        }
        if (o.createdAt >= sparklineStart) {
          const key = o.createdAt.toFormat('yyyy-MM-dd')
          dailyMap.set(key, (dailyMap.get(key) ?? 0) + o.totalAmountCents)
        }
      }
    }

    const topServices = [...byService.entries()]
      .map(([serviceId, v]) => ({ serviceId, ...v }))
      .sort((a, b) => b.revenueCents - a.revenueCents)
      .slice(0, 5)

    const dailyRevenue = Array.from({ length: 14 }, (_, i) => {
      const date = sparklineStart.plus({ days: i })
      const key = date.toFormat('yyyy-MM-dd')
      return { date: key, revenueCents: dailyMap.get(key) ?? 0 }
    })

    const recentScansQuery = Scan.query()
      .where('orgId', orgId)
      .where('result', 'valid')
      .orderBy('createdAt', 'desc')
      .limit(8)
    if (allowedServiceIds) recentScansQuery.whereIn('serviceId', allowedServiceIds)
    const recentScans = await recentScansQuery

    const recentActivity = [
      ...recentOrdersAll
        .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
        .slice(0, 8)
        .map((o) => ({
          type: 'order' as const,
          serviceId: o.serviceId,
          createdAt: o.createdAt.toISO(),
          ticketCount: o.qtyTickets,
          amountCents: o.totalAmountCents,
          soldBy: o.soldBy,
          paymentReference: o.paymentReference,
        })),
      ...recentScans.map((s) => ({
        type: 'scan' as const,
        serviceId: s.serviceId,
        createdAt: s.createdAt.toISO(),
      })),
    ]
      .sort((a, b) => ((a.createdAt ?? '') < (b.createdAt ?? '') ? 1 : -1))
      .slice(0, 8)

    return ctx.response.send({
      data: {
        monthRevenueCents,
        monthTicketsSold,
        monthTicketsScanned,
        prevMonthRevenueCents,
        dailyRevenue,
        topServices,
        recentActivity,
      },
    })
  }

  async index(ctx: HttpContext) {
    const { serviceId, status, q, dateFrom, dateTo, page, perPage } =
      await ctx.request.validateUsing(listOrdersValidator)
    const { orgId, role, servicePermissions } = ctx.internalAuth

    if (role !== 'admin' && !servicePermissions?.[String(serviceId)]?.canViewHistory) {
      return ctx.response.status(403).send({ error: 'permission_required' })
    }

    return runOnTenant(serviceId, async () => {
      const query = Order.query()
        .where('orgId', orgId)
        .where('serviceId', serviceId)
        .orderBy('createdAt', 'desc')
        .preload('tickets')

      if (status) query.where('status', status)
      if (q) {
        query.where((sub) => {
          sub.whereILike('paymentReference', `%${q}%`).orWhereILike('email', `%${q}%`)
        })
      }
      if (dateFrom) query.where('createdAt', '>=', dateFrom.toJSDate())
      if (dateTo) query.where('createdAt', '<=', dateTo.plus({ days: 1 }).toJSDate())

      // Tronquer à 100 sans le dire au staff cachait qu'une liste plus
      // longue existait — la pagination le rend explicite (meta.total).
      const orders = await query.paginate(page ?? 1, perPage ?? 25)

      return ctx.response.send({
        data: orders.all().map((order) => ({
          id: order.id,
          paymentReference: order.paymentReference,
          createdAt: order.createdAt.toISO(),
          visitDate: order.visitDate.toISODate(),
          email: order.email,
          qtyTickets: order.qtyTickets,
          totalAmountCents: order.totalAmountCents,
          status: order.status,
          paymentMethod: order.paymentMethod,
          soldBy: order.soldBy,
          consumedCount: order.tickets.filter((t) => t.status === 'consumed').length,
          retryCount: order.retryCount,
          tickets: order.tickets.map((t) => ({
            id: t.id,
            tariffType: t.tariffType,
            status: t.status,
            consumedAt: t.consumedAt?.toISO() ?? null,
            consumedByLabel: t.consumedByLabel,
          })),
        })),
        meta: orders.getMeta(),
      })
    })
  }

  /**
   * GET /orders/:id/payment-attempts — l'id de commande seul ne dit pas
   * quel service (donc quelle base) — fan-out borné à l'organisme entier
   * (pas seulement aux services de l'agent) : c'est le même périmètre que
   * le comportement d'avant le split, où la recherche était par orgId
   * seul, le droit d'en voir le détail étant vérifié APRÈS coup via
   * canViewHistory sur le service réel de la commande trouvée.
   *
   * Lu depuis order_payment_attempts, jamais depuis svc-gestion : ce
   * service n'a plus besoin de gestion pour afficher son propre
   * historique de tentatives (voir échange du 2026-09-03). La contrepartie
   * assumée : une session PayFiP simplement abandonnée par le citoyen
   * (jamais de webhook, ni paid ni failed) reste affichée
   * "awaiting_payment" indéfiniment ici, alors que svc-gestion la
   * basculerait en "expired" après 15 min — gestion garde cette
   * connaissance-là pour son propre dashboard staff, pas nous.
   */
  async paymentAttempts(ctx: HttpContext) {
    const { orgId, role, servicePermissions } = ctx.internalAuth

    const order = await findOrderInOrg(Number(orgId), Number(ctx.params.id))

    if (!order) {
      return ctx.response.status(404).send({ error: 'order_not_found' })
    }

    if (role !== 'admin' && !servicePermissions?.[String(order.serviceId)]?.canViewHistory) {
      return ctx.response.status(403).send({ error: 'permission_required' })
    }

    const attempts = await runOnTenant(order.serviceId, () =>
      OrderPaymentAttempt.query().where('orderId', order.id).orderBy('createdAt', 'asc')
    )

    return ctx.response.send({
      data: attempts.map((a) => ({
        id: a.id,
        status: a.status,
        createdAt: a.createdAt.toISO(),
        paidAt: a.paidAt?.toISO() ?? null,
        isRetry: a.isRetry,
      })),
    })
  }

  /**
   * GET /orders/staff — réservé au staff AREGIE : vue par organisme
   * (orgId obligatoire depuis le split par service) pour le dashboard,
   * filtrable par service. Fan-out borné aux services billetterie de cet
   * organisme, fusion/tri/pagination en mémoire.
   */
  async staffIndex(ctx: HttpContext) {
    if (ctx.internalAuth.scope !== 'staff') {
      return ctx.response.status(403).send({ error: 'scope_not_allowed' })
    }

    const { orgId, serviceId, status, q, dateFrom, dateTo, page, perPage } =
      await ctx.request.validateUsing(listOrdersStaffValidator)

    const candidateServiceIds = serviceId ? [serviceId] : await ensureTenantConnectionsForOrg(orgId)

    const matches: Order[] = []
    for (const sid of candidateServiceIds) {
      const rows = await runOnTenant(sid, () => {
        const query = Order.query().where('orgId', orgId).orderBy('createdAt', 'desc')
        if (status) query.where('status', status)
        if (q) {
          query.where((sub) => {
            sub.whereILike('paymentReference', `%${q}%`).orWhereILike('email', `%${q}%`)
          })
        }
        if (dateFrom) query.where('createdAt', '>=', dateFrom.toJSDate())
        if (dateTo) query.where('createdAt', '<=', dateTo.plus({ days: 1 }).toJSDate())
        return query
      })
      matches.push(...rows)
    }

    matches.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())

    const perPageResolved = perPage ?? 25
    const pageResolved = page ?? 1
    const start = (pageResolved - 1) * perPageResolved
    const pageItems = matches.slice(start, start + perPageResolved)

    return ctx.response.send({
      data: pageItems.map((order) => ({
        id: order.id,
        createdAt: order.createdAt.toISO(),
        orgId: order.orgId,
        serviceId: order.serviceId,
        visitDate: order.visitDate.toISODate(),
        email: order.email,
        qtyTickets: order.qtyTickets,
        totalAmountCents: order.totalAmountCents,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentReference: order.paymentReference,
      })),
      meta: {
        total: matches.length,
        perPage: perPageResolved,
        currentPage: pageResolved,
        lastPage: Math.max(1, Math.ceil(matches.length / perPageResolved)),
      },
    })
  }

  /**
   * POST /orders — achat en ligne. L'email doit avoir été vérifié par
   * OTP juste avant (voir /otp/verify), sinon on refuse.
   */
  async store(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(createOrderValidator)
    const { orgId } = ctx.internalAuth

    const verified = await isEmailVerified(payload.email)
    if (!verified) return ctx.response.status(403).send({ error: 'email_not_otp_verified' })

    const serviceAvailability = await fetchServiceStatus(Number(orgId), payload.serviceId)
    if (
      !serviceAvailability ||
      serviceAvailability.status !== 'active' ||
      !serviceAvailability.isOpen
    ) {
      return ctx.response.status(409).send({ error: 'service_closed' })
    }
    if (
      !isVisitDateOpen(serviceAvailability.openingDays, payload.visitDate) ||
      isVisitDateInClosure(serviceAvailability.closures, payload.visitDate)
    ) {
      return ctx.response.status(422).send({ error: 'visit_date_closed' })
    }

    return runOnTenant(payload.serviceId, async () => {
      let totals
      try {
        totals = await computeOrderTotals(Number(orgId), payload.serviceId, payload.tickets)
      } catch (error) {
        if (error instanceof UnknownTariffTypeError) {
          return ctx.response.status(422).send({ error: 'unknown_tariff_type' })
        }
        throw error
      }

      const isFree = totals.totalAmountCents === 0
      const connectionName = tenantConnectionStorage.getStore()!

      const { order, tickets } = await db.connection(connectionName).transaction(async (trx) => {
        const newOrder = await Order.create(
          {
            orgId: Number(orgId),
            serviceId: payload.serviceId,
            email: payload.email,
            visitDate: payload.visitDate,
            qtyTickets: totals.qtyTickets,
            totalAmountCents: totals.totalAmountCents,
            status: isFree ? 'confirmed' : 'draft',
            paymentMethod: isFree ? 'free' : 'payfip',
            otpVerifiedAt: DateTime.now(),
            accessToken: randomUUID(),
          },
          { client: trx }
        )

        await OrderLine.createMany(
          totals.lines.map((line) => ({
            orderId: newOrder.id,
            tariffType: line.tariffType,
            quantity: line.quantity,
            unitPriceCents: line.unitPriceCents,
          })),
          { client: trx }
        )

        newOrder.paymentReference = buildPaymentReference(payload.serviceId, newOrder.id)
        await newOrder.save()

        const newTickets = isFree ? await generateTicketsForOrder(newOrder, trx) : []
        return { order: newOrder, tickets: newTickets }
      })

      if (isFree) {
        await sendTicketConfirmationEmail(order, tickets)

        return ctx.response.status(201).send({
          data: {
            orderId: order.id,
            paymentReference: order.paymentReference,
            accessToken: order.accessToken,
            status: order.status,
            free: true,
            message:
              "Réservation gratuite confirmée — aucun paiement n'est nécessaire. Merci de vous munir d'un justificatif (pièce d'identité, carte famille nombreuse…) à l'entrée de l'événement.",
          },
        })
      }

      let paymentRequest
      try {
        paymentRequest = await createPaymentRequest({
          orgId,
          serviceId: order.serviceId,
          sourceReference: order.paymentReference!,
          amountCents: order.totalAmountCents,
          objectLabel: `Billetterie ${order.qtyTickets} billet${order.qtyTickets > 1 ? 's' : ''}`,
          payerEmail: order.email,
          frontRedirectUrl: payload.frontRedirectUrl,
        })
      } catch (error) {
        order.status = 'cancelled'
        await order.save()

        if (error instanceof SvcGestionError && error.status < 500) {
          return ctx.response.status(error.status).send(error.body)
        }
        throw error
      }

      order.paymentRequestId = paymentRequest.id
      order.payfipIdOp = paymentRequest.payfipIdOp
      order.status = 'awaiting_payment'
      await order.save()

      await OrderPaymentAttempt.create({
        orderId: order.id,
        paymentRequestId: paymentRequest.id,
        status: 'awaiting_payment',
        isRetry: false,
      })

      return ctx.response.status(201).send({
        data: {
          orderId: order.id,
          status: order.status,
          paymentUrl: paymentRequest.paymentUrl,
          payfipIdOp: paymentRequest.payfipIdOp,
        },
      })
    })
  }

  /**
   * POST /orders/agent-sale — vente sur place, encaissement déjà fait
   * physiquement (CB, espèces, chèque...), donc hors circuit PayFiP.
   * Billets générés immédiatement, pas d'attente.
   */
  async agentSale(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(agentSaleValidator)
    const { orgId, sub, role, servicePermissions, serviceIds } = ctx.internalAuth

    if (!sub) {
      return ctx.response.status(403).send({ error: 'agent_id_missing_in_token' })
    }

    if (!serviceIds?.includes(payload.serviceId)) {
      return ctx.response.status(403).send({ error: 'service_not_allowed_for_agent' })
    }

    if (role !== 'admin' && !servicePermissions?.[String(payload.serviceId)]?.canSell) {
      return ctx.response.status(403).send({ error: 'permission_required' })
    }

    const serviceAvailability = await fetchServiceStatus(Number(orgId), payload.serviceId)
    if (
      !serviceAvailability ||
      serviceAvailability.status !== 'active' ||
      !serviceAvailability.isOpen
    ) {
      return ctx.response.status(409).send({ error: 'service_closed' })
    }
    if (
      !isVisitDateOpen(serviceAvailability.openingDays, payload.visitDate) ||
      isVisitDateInClosure(serviceAvailability.closures, payload.visitDate)
    ) {
      return ctx.response.status(422).send({ error: 'visit_date_closed' })
    }

    return runOnTenant(payload.serviceId, async () => {
      let totals
      try {
        totals = await computeOrderTotals(Number(orgId), payload.serviceId, payload.tickets)
      } catch (error) {
        if (error instanceof UnknownTariffTypeError) {
          return ctx.response.status(422).send({ error: 'unknown_tariff_type' })
        }
        throw error
      }

      const connectionName = tenantConnectionStorage.getStore()!

      const { order, tickets } = await db.connection(connectionName).transaction(async (trx) => {
        const newOrder = await Order.create(
          {
            orgId: Number(orgId),
            serviceId: payload.serviceId,
            email: payload.email,
            visitDate: payload.visitDate,
            qtyTickets: totals.qtyTickets,
            totalAmountCents: totals.totalAmountCents,
            status: 'confirmed',
            paymentMethod: totals.totalAmountCents === 0 ? 'free' : payload.paymentMethod,
            agentId: Number(sub),
            soldBy: agentLabel(ctx.internalAuth),
            otpVerifiedAt: null,
          },
          { client: trx }
        )

        await OrderLine.createMany(
          totals.lines.map((line) => ({
            orderId: newOrder.id,
            tariffType: line.tariffType,
            quantity: line.quantity,
            unitPriceCents: line.unitPriceCents,
          })),
          { client: trx }
        )

        newOrder.paymentReference = buildPaymentReference(payload.serviceId, newOrder.id)
        await newOrder.save()

        const newTickets = await generateTicketsForOrder(newOrder, trx)
        return { order: newOrder, tickets: newTickets }
      })

      await sendTicketConfirmationEmail(order, tickets)

      return ctx.response.status(201).send({
        data: {
          orderId: order.id,
          paymentReference: order.paymentReference,
          status: order.status,
          tickets: tickets.map(serializeTicket),
        },
      })
    })
  }

  /**
   * POST /orders/:id/resend-confirmation — même périmètre de recherche
   * que paymentAttempts() (fan-out org entier, permission vérifiée après
   * coup sur le service réel trouvé).
   */
  async resendConfirmation(ctx: HttpContext) {
    const { orgId, role, servicePermissions, serviceIds } = ctx.internalAuth

    const order = await findOrderInOrg(Number(orgId), Number(ctx.params.id))

    if (!order) {
      return ctx.response.status(404).send({ error: 'order_not_found' })
    }

    if (!serviceIds?.includes(order.serviceId)) {
      return ctx.response.status(403).send({ error: 'service_not_allowed_for_agent' })
    }

    if (role !== 'admin' && !servicePermissions?.[String(order.serviceId)]?.canSell) {
      return ctx.response.status(403).send({ error: 'permission_required' })
    }

    if (order.status !== 'confirmed') {
      return ctx.response.status(409).send({ error: 'order_not_confirmed' })
    }

    await runOnTenant(order.serviceId, async () => {
      const tickets = await Ticket.query().where('orderId', order.id)
      await sendTicketConfirmationEmail(order, tickets)
    })

    return ctx.response.send({ data: { sent: true } })
  }

  /**
   * GET /orders/:id/agent-tickets-pdf — même périmètre de recherche que
   * paymentAttempts()/resendConfirmation().
   */
  async agentTicketsPdf(ctx: HttpContext) {
    const { orgId, role, servicePermissions, serviceIds } = ctx.internalAuth

    const order = await findOrderInOrg(Number(orgId), Number(ctx.params.id))

    if (!order) {
      return ctx.response.status(404).send({ error: 'order_not_found' })
    }

    if (!serviceIds?.includes(order.serviceId)) {
      return ctx.response.status(403).send({ error: 'service_not_allowed_for_agent' })
    }

    if (role !== 'admin' && !servicePermissions?.[String(order.serviceId)]?.canSell) {
      return ctx.response.status(403).send({ error: 'permission_required' })
    }

    return runOnTenant(order.serviceId, async () => {
      const tickets = await Ticket.query().where('orderId', order.id).orderBy('id', 'asc')
      if (tickets.length === 0) {
        return ctx.response.status(404).send({ error: 'no_tickets_for_order' })
      }

      const pdf = await generateOrderTicketsPdf(tickets, order)

      ctx.response.header('Content-Type', 'application/pdf')
      ctx.response.header(
        'Content-Disposition',
        `inline; filename="billets-${order.paymentReference ?? order.id}.pdf"`
      )
      return ctx.response.send(pdf)
    })
  }

  /**
   * POST /orders/scan — le code embarque désormais le serviceId (voir
   * order_code_service.ts) : routage direct, aucun fan-out.
   */
  async scanOrder(ctx: HttpContext) {
    const { code } = await ctx.request.validateUsing(scanOrderValidator)
    const { orgId, role, servicePermissions, serviceIds } = ctx.internalAuth

    const decoded = decodeOrderCode(code)
    if (!decoded) {
      return ctx.response.status(422).send({ error: 'invalid_signature' })
    }

    return runOnTenant(decoded.serviceId, async () => {
      const order = await Order.query().where('id', decoded.orderId).where('orgId', orgId).first()
      if (!order || order.serviceId !== decoded.serviceId) {
        return ctx.response.status(404).send({ error: 'order_not_found' })
      }

      if (!serviceIds?.includes(order.serviceId)) {
        return ctx.response.status(403).send({ error: 'service_not_allowed_for_agent' })
      }

      if (role !== 'admin' && !servicePermissions?.[String(order.serviceId)]?.canScan) {
        return ctx.response.status(403).send({ error: 'permission_required' })
      }

      const tickets = await Ticket.query().where('orderId', order.id).orderBy('id', 'asc')

      return ctx.response.send({
        data: {
          orderId: order.id,
          paymentReference: order.paymentReference,
          tickets: tickets.map((t) => ({
            id: t.id,
            tariffType: t.tariffType,
            visitDate: t.visitDate.toISODate(),
            status: t.status,
            code: encodeTicketCode(t.serviceId, t.id),
            consumedAt: t.consumedAt?.toISO() ?? null,
          })),
        },
      })
    })
  }

  /**
   * GET /orders/:id/tickets — un id de commande seul ne dit pas quel
   * service : fan-out borné à l'organisme, désambiguïsé par
   * hasOrderAccess (idOp/accessToken), jamais par l'id seul.
   */
  async tickets(ctx: HttpContext) {
    const idop = ctx.request.qs().idop
    const order = await findAccessibleOrder(ctx.internalAuth.orgId, Number(ctx.params.id), idop)
    return respondWithOrderTickets(ctx, order)
  }

  /**
   * GET /orders/by-reference/:reference/tickets — paymentReference porte
   * le serviceId : routage direct.
   */
  async ticketsByReference(ctx: HttpContext) {
    const parsed = parsePaymentReference(ctx.params.reference)
    if (!parsed) {
      return ctx.response.status(404).send({ error: 'order_not_found' })
    }
    const order = await runOnTenant(parsed.serviceId, () =>
      Order.findBy('paymentReference', ctx.params.reference)
    )
    return respondWithOrderTickets(ctx, order)
  }

  async ticketPdf(ctx: HttpContext) {
    const idop = ctx.request.qs().idop
    const order = await findAccessibleOrder(ctx.internalAuth.orgId, Number(ctx.params.id), idop)
    return respondWithTicketPdf(ctx, order, Number(ctx.params.ticketId))
  }

  async ticketPdfByReference(ctx: HttpContext) {
    const parsed = parsePaymentReference(ctx.params.reference)
    if (!parsed) {
      return ctx.response.status(404).send({ error: 'order_not_found' })
    }
    const order = await runOnTenant(parsed.serviceId, () =>
      Order.findBy('paymentReference', ctx.params.reference)
    )
    return respondWithTicketPdf(ctx, order, Number(ctx.params.ticketId))
  }

  async ticketsPdf(ctx: HttpContext) {
    const idop = ctx.request.qs().idop
    const order = await findAccessibleOrder(ctx.internalAuth.orgId, Number(ctx.params.id), idop)
    return respondWithOrderTicketsPdf(ctx, order)
  }

  async ticketsPdfByReference(ctx: HttpContext) {
    const parsed = parsePaymentReference(ctx.params.reference)
    if (!parsed) {
      return ctx.response.status(404).send({ error: 'order_not_found' })
    }
    const order = await runOnTenant(parsed.serviceId, () =>
      Order.findBy('paymentReference', ctx.params.reference)
    )
    return respondWithOrderTicketsPdf(ctx, order)
  }

  /**
   * POST /orders/by-reference/:reference/retry-payment — paymentReference
   * porte le serviceId : routage direct, aucun fan-out.
   */
  async retryPayment(ctx: HttpContext) {
    const parsed = parsePaymentReference(ctx.params.reference)
    if (!parsed) {
      return ctx.response.status(404).send({ error: 'order_not_found' })
    }

    const idop = ctx.request.qs().idop
    const { orgId } = ctx.internalAuth

    return runOnTenant(parsed.serviceId, async () => {
      const order = await Order.findBy('paymentReference', ctx.params.reference)

      if (
        !order ||
        String(order.orgId) !== orgId ||
        !order.payfipIdOp ||
        order.payfipIdOp !== idop
      ) {
        return ctx.response.status(404).send({ error: 'order_not_found' })
      }

      if (order.status !== 'cancelled') {
        return ctx.response
          .status(409)
          .send({ error: 'order_not_retryable', status: order.status })
      }

      const payload = await ctx.request.validateUsing(retryOrderPaymentValidator)

      let paymentRequest
      try {
        paymentRequest = await retryPaymentRequest(order.paymentRequestId!, {
          orgId,
          serviceId: order.serviceId,
          sourceReference: order.paymentReference!,
          amountCents: order.totalAmountCents,
          objectLabel: `Billetterie ${order.qtyTickets} billet${order.qtyTickets > 1 ? 's' : ''}`,
          payerEmail: order.email,
          frontRedirectUrl: payload.frontRedirectUrl,
        })
      } catch (error) {
        if (error instanceof SvcGestionError && error.status < 500) {
          return ctx.response.status(error.status).send(error.body)
        }
        throw error
      }

      order.paymentRequestId = paymentRequest.id
      order.payfipIdOp = paymentRequest.payfipIdOp
      order.status = 'awaiting_payment'
      order.retryCount += 1
      await order.save()

      await OrderPaymentAttempt.create({
        orderId: order.id,
        paymentRequestId: paymentRequest.id,
        status: 'awaiting_payment',
        isRetry: true,
      })

      return ctx.response.send({
        data: {
          orderId: order.id,
          status: order.status,
          paymentUrl: paymentRequest.paymentUrl,
          payfipIdOp: paymentRequest.payfipIdOp,
        },
      })
    })
  }

  /**
   * POST /payment-webhooks — sourceReference porte le serviceId : routage
   * direct, aucun fan-out.
   */
  async paymentWebhook(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(paymentWebhookValidator)

    const parsed = parsePaymentReference(payload.sourceReference)
    if (!parsed) {
      return ctx.response.status(404).send({ error: 'order_not_found' })
    }

    return runOnTenant(parsed.serviceId, async () => {
      const order = await Order.findBy('paymentReference', payload.sourceReference)
      if (!order) {
        return ctx.response.status(404).send({ error: 'order_not_found' })
      }

      if (order.status !== 'awaiting_payment') {
        return ctx.response.send({ received: true, alreadyProcessed: true })
      }

      if (
        payload.amountCents !== order.totalAmountCents ||
        payload.paymentRequestId !== order.paymentRequestId
      ) {
        logger.warn(
          { orderId: order.id, payload },
          'paymentWebhook rejeté — montant ou paymentRequestId incohérent'
        )
        return ctx.response.status(422).send({ error: 'payment_webhook_mismatch' })
      }

      const connectionName = tenantConnectionStorage.getStore()!
      const paidAt = payload.status === 'paid' ? DateTime.now() : null

      if (payload.status === 'paid') {
        const tickets = await db.connection(connectionName).transaction(async (trx) => {
          const rows = await trx
            .from('orders')
            .where('id', order.id)
            .where('status', 'awaiting_payment')
            .update({ status: 'confirmed', updated_at: DateTime.now().toSQL() }, ['*'])

          if (rows.length === 0) {
            return null
          }

          order.status = 'confirmed'
          return generateTicketsForOrder(order, trx)
        })

        if (tickets) {
          await sendTicketConfirmationEmail(order, tickets)
          await OrderPaymentAttempt.query()
            .where('orderId', order.id)
            .where('paymentRequestId', payload.paymentRequestId)
            .update({ status: 'paid', paidAt: paidAt?.toSQL() })
        }
      } else {
        const rows = await db
          .connection(connectionName)
          .from('orders')
          .where('id', order.id)
          .where('status', 'awaiting_payment')
          .update({ status: 'cancelled', updated_at: DateTime.now().toSQL() }, ['id'])

        if (rows.length > 0) {
          await OrderPaymentAttempt.query()
            .where('orderId', order.id)
            .where('paymentRequestId', payload.paymentRequestId)
            .update({ status: 'failed' })
        }
      }

      return ctx.response.send({ received: true })
    })
  }
}

/**
 * Recherche une commande par id à travers toutes les bases tenant de
 * l'organisme — même périmètre que la requête `where('orgId', orgId)`
 * d'avant le split, qui ne filtrait pas déjà par service. Utilisé par les
 * routes agent (paymentAttempts/resendConfirmation/agentTicketsPdf) où le
 * droit d'agir est vérifié après coup sur le service réel trouvé.
 */
async function findOrderInOrg(orgId: number, orderId: number): Promise<Order | null> {
  const serviceIds = await ensureTenantConnectionsForOrg(orgId)
  for (const serviceId of serviceIds) {
    const order = await runOnTenant(serviceId, () =>
      Order.query().where('id', orderId).where('orgId', orgId).first()
    )
    if (order) return order
  }
  return null
}

/**
 * Recherche une commande citoyenne accessible : fan-out borné à
 * l'organisme, désambiguïsé par hasOrderAccess (idOp/accessToken) — un
 * id de commande peut exister dans plusieurs bases tenant du même
 * organisme (chaque service a sa propre séquence d'id), mais au plus une
 * seule aura le bon secret.
 */
async function findAccessibleOrder(
  orgId: string,
  orderId: number,
  idop: unknown
): Promise<Order | null> {
  const serviceIds = await ensureTenantConnectionsForOrg(Number(orgId))
  for (const serviceId of serviceIds) {
    const order = await runOnTenant(serviceId, () => Order.find(orderId))
    if (order && hasOrderAccess(order, orgId, idop)) return order
  }
  return null
}

async function respondWithOrderTickets(ctx: HttpContext, order: Order | null) {
  const idop = ctx.request.qs().idop

  if (!order || !hasOrderAccess(order, ctx.internalAuth.orgId, idop)) {
    return ctx.response.status(404).send({ error: 'order_not_found' })
  }

  return runOnTenant(order.serviceId, async () => {
    const tickets = await Ticket.query().where('orderId', order.id)

    return ctx.response.send({
      data: {
        orderId: order.id,
        status: order.status,
        orderCode: encodeOrderCode(order.serviceId, order.id),
        tickets: tickets.map(serializeTicket),
      },
    })
  })
}

async function respondWithTicketPdf(ctx: HttpContext, order: Order | null, ticketId: number) {
  const idop = ctx.request.qs().idop

  if (!order || !hasOrderAccess(order, ctx.internalAuth.orgId, idop)) {
    return ctx.response.status(404).send({ error: 'order_not_found' })
  }

  return runOnTenant(order.serviceId, async () => {
    const ticket = await Ticket.query().where('id', ticketId).where('orderId', order.id).first()
    if (!ticket) {
      return ctx.response.status(404).send({ error: 'ticket_not_found' })
    }

    const pdf = await generateTicketPdf(ticket, order)

    ctx.response.header('Content-Type', 'application/pdf')
    ctx.response.header('Content-Disposition', `attachment; filename="billet-${ticket.id}.pdf"`)
    return ctx.response.send(pdf)
  })
}

async function respondWithOrderTicketsPdf(ctx: HttpContext, order: Order | null) {
  const idop = ctx.request.qs().idop

  if (!order || !hasOrderAccess(order, ctx.internalAuth.orgId, idop)) {
    return ctx.response.status(404).send({ error: 'order_not_found' })
  }

  return runOnTenant(order.serviceId, async () => {
    const tickets = await Ticket.query().where('orderId', order.id).orderBy('id', 'asc')
    if (tickets.length === 0) {
      return ctx.response.status(404).send({ error: 'no_tickets_for_order' })
    }

    const pdf = await generateOrderTicketsPdf(tickets, order)

    ctx.response.header('Content-Type', 'application/pdf')
    ctx.response.header(
      'Content-Disposition',
      `attachment; filename="billets-${order.paymentReference ?? order.id}.pdf"`
    )
    return ctx.response.send(pdf)
  })
}

/**
 * Preuve de possession pour les routes publiques de lecture de billets —
 * en plus de orgId, il faut le payfip_id_op (paiement PayFiP réel) OU
 * l'access_token (généré à la création, seule preuve disponible pour une
 * commande gratuite qui n'a jamais de session PayFiP). Référence seule
 * (BILLxxxxxxxxxxxxxx) est prévisible, ni l'un ni l'autre ne l'est.
 */
function hasOrderAccess(order: Order, orgId: string, idop: unknown): boolean {
  if (String(order.orgId) !== orgId) return false
  if (typeof idop !== 'string' || !idop) return false
  return idop === order.payfipIdOp || idop === order.accessToken
}
