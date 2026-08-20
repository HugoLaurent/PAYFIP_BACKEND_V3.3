import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import Order from '#models/order'
import OrderLine from '#models/order_line'
import Ticket from '#models/ticket'
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
import {
  createPaymentRequest,
  retryPaymentRequest,
  listPaymentAttempts,
  SvcGestionError,
} from '#services/svc_gestion_client'
import { fetchServiceStatus } from '#services/svc_auth_client'
import { agentLabel } from '#services/agent_label_service'
import { generateTicketsForOrder } from '#services/ticket_generation_service'
import { encodeTicketCode } from '#services/ticket_code_service'
import { decodeOrderCode, encodeOrderCode } from '#services/order_code_service'
import { generateTicketPdf, generateOrderTicketsPdf } from '#services/ticket_pdf_service'
import { sendTicketConfirmationEmail } from '#services/ticket_confirmation_mail_service'

function serializeTicket(ticket: Ticket) {
  return {
    id: ticket.id,
    tariffType: ticket.tariffType,
    priceAtPurchaseCents: ticket.priceAtPurchaseCents,
    visitDate: ticket.visitDate.toISODate(),
    status: ticket.status,
    code: encodeTicketCode(ticket.id),
  }
}

export default class OrdersController {
  /**
   * GET /orders/stats — indicateurs du mois en cours, tous services
   * billetterie confondus (jamais un appel par service : ça ne passerait
   * pas à l'échelle pour un organisme avec beaucoup de services). Un
   * admin voit tout l'organisme ; un agent seulement les services où il a
   * canViewHistory.
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
          data: { monthRevenueCents: 0, monthTicketsSold: 0, monthTicketsScanned: 0 },
        })
      }
    }

    const monthStart = DateTime.now().startOf('month')

    const orderQuery = db
      .from('orders')
      .where('org_id', orgId)
      .where('status', 'confirmed')
      .where('created_at', '>=', monthStart.toSQL()!)
    if (allowedServiceIds) orderQuery.whereIn('service_id', allowedServiceIds)
    const orderStats = await orderQuery
      .sum('total_amount_cents as revenue')
      .sum('qty_tickets as tickets')
      .first()

    const scanQuery = db
      .from('tickets')
      .where('org_id', orgId)
      .whereNotNull('consumed_at')
      .where('consumed_at', '>=', monthStart.toSQL()!)
    if (allowedServiceIds) scanQuery.whereIn('service_id', allowedServiceIds)
    const scanStats = await scanQuery.count('* as total').first()

    return ctx.response.send({
      data: {
        monthRevenueCents: Number(orderStats?.revenue ?? 0),
        monthTicketsSold: Number(orderStats?.tickets ?? 0),
        monthTicketsScanned: Number(scanStats?.total ?? 0),
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
  }

  /**
   * GET /orders/:id/payment-attempts — détail des tentatives de paiement
   * d'une commande (statuts + dates), pour qu'un agent puisse répondre à
   * un client qui a payé plusieurs fois. Même droit que l'Historique lui-
   * même (canViewHistory sur le service de CETTE commande).
   */
  async paymentAttempts(ctx: HttpContext) {
    const { orgId, role, servicePermissions } = ctx.internalAuth

    const order = await Order.query()
      .where('id', Number(ctx.params.id))
      .where('orgId', orgId)
      .first()

    if (!order) {
      return ctx.response.status(404).send({ error: 'order_not_found' })
    }

    if (role !== 'admin' && !servicePermissions?.[String(order.serviceId)]?.canViewHistory) {
      return ctx.response.status(403).send({ error: 'permission_required' })
    }

    if (!order.paymentReference) {
      return ctx.response.send({ data: [] })
    }

    const attempts = await listPaymentAttempts(String(orgId), order.paymentReference)
    return ctx.response.send({ data: attempts })
  }

  /**
   * GET /orders/staff — réservé au staff AREGIE : vue tous organismes
   * pour le dashboard, avec filtres optionnels par organisme/service.
   */
  async staffIndex(ctx: HttpContext) {
    if (ctx.internalAuth.scope !== 'staff') {
      return ctx.response.status(403).send({ error: 'scope_not_allowed' })
    }

    const { orgId, serviceId, status, q, dateFrom, dateTo, page, perPage } =
      await ctx.request.validateUsing(listOrdersStaffValidator)

    const query = Order.query().orderBy('createdAt', 'desc')
    if (orgId) query.where('orgId', orgId)
    if (serviceId) query.where('serviceId', serviceId)
    if (status) query.where('status', status)
    if (q) {
      query.where((sub) => {
        sub.whereILike('paymentReference', `%${q}%`).orWhereILike('email', `%${q}%`)
      })
    }
    if (dateFrom) query.where('createdAt', '>=', dateFrom.toJSDate())
    if (dateTo) query.where('createdAt', '<=', dateTo.plus({ days: 1 }).toJSDate())

    const orders = await query.paginate(page ?? 1, perPage ?? 25)

    return ctx.response.send({
      data: orders.all().map((order) => ({
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
      meta: orders.getMeta(),
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

    const serviceStatus = await fetchServiceStatus(Number(orgId), payload.serviceId)
    if (serviceStatus !== 'active') {
      return ctx.response.status(409).send({ error: 'service_closed' })
    }

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

    const { order, tickets } = await db.transaction(async (trx) => {
      const newOrder = await Order.create(
        {
          orgId: Number(orgId),
          serviceId: payload.serviceId,
          email: payload.email,
          visitDate: payload.visitDate,
          qtyTickets: totals.qtyTickets,
          totalAmountCents: totals.totalAmountCents,
          // Gratuit : confirmée tout de suite, jamais de session PayFiP —
          // il n'y a rien à payer. Payant : circuit habituel (draft en
          // attendant l'ouverture de la session PayFiP juste après).
          status: isFree ? 'confirmed' : 'draft',
          paymentMethod: isFree ? 'free' : 'payfip',
          otpVerifiedAt: DateTime.now(),
          // Preuve de possession indépendante de payfip_id_op — une
          // commande gratuite n'aura jamais de session PayFiP, donc jamais
          // de payfip_id_op, mais doit quand même pouvoir donner accès à
          // ses billets (page de retour, PDF) au même titre qu'une payante.
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

      newOrder.paymentReference = `BILL${String(newOrder.id).padStart(8, '0')}`
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

    return ctx.response.status(201).send({
      data: {
        orderId: order.id,
        status: order.status,
        paymentUrl: paymentRequest.paymentUrl,
        payfipIdOp: paymentRequest.payfipIdOp,
      },
    })
  }

  /**
   * POST /orders/agent-sale — vente sur place, encaissement déjà fait
   * physiquement (CB, espèces, chèque...), donc hors circuit PayFiP.
   * Billets générés immédiatement, pas d'attente.
   *
   * L'autorisation "cet agent a-t-il le droit de vendre pour CE service
   * précis" est vérifiée ici via serviceIds (propagé par le Gateway
   * depuis les services accessibles renvoyés par svc-auth) — pas
   * seulement au niveau du Gateway, qui ne peut pas le faire pour tous
   * les endpoints (voir scanTicket, où le service n'est connu qu'après
   * résolution du ticket).
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

    // Le JWT client d'un agent peut avoir jusqu'à 20 min de retard sur un
    // service qu'un admin vient de fermer — le front masque déjà le
    // bouton de vente, mais l'API doit refuser elle-même, pas seulement
    // compter sur l'UI.
    const serviceStatus = await fetchServiceStatus(Number(orgId), payload.serviceId)
    if (serviceStatus !== 'active') {
      return ctx.response.status(409).send({ error: 'service_closed' })
    }

    let totals
    try {
      totals = await computeOrderTotals(Number(orgId), payload.serviceId, payload.tickets)
    } catch (error) {
      // Seule une erreur métier connue (tarif inconnu) devient un 422 — une
      // vraie panne (DB indisponible, bug) ne doit jamais être maquillée
      // en erreur de saisie du citoyen.
      if (error instanceof UnknownTariffTypeError) {
        return ctx.response.status(422).send({ error: 'unknown_tariff_type' })
      }
      throw error
    }

    // Commande + lignes + billets : tout ou rien — une vente sur place est
    // encaissée immédiatement, donc "confirmée" doit toujours vouloir dire
    // "tous les billets payés existent réellement", jamais moins.
    const { order, tickets } = await db.transaction(async (trx) => {
      const newOrder = await Order.create(
        {
          orgId: Number(orgId),
          serviceId: payload.serviceId,
          email: payload.email,
          visitDate: payload.visitDate,
          qtyTickets: totals.qtyTickets,
          totalAmountCents: totals.totalAmountCents,
          status: 'confirmed',
          // Un total à 0€ (tarifs gratuits) n'est ni des espèces ni une
          // carte : on l'impose côté serveur plutôt que de faire confiance
          // à ce que le front a choisi par défaut.
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

      // Même format que les commandes en ligne : un agent qui encaisse sur
      // place doit pouvoir donner une référence lisible au client, pas
      // juste l'id brut de la commande.
      newOrder.paymentReference = `BILL${String(newOrder.id).padStart(8, '0')}`
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
  }

  /**
   * POST /orders/:id/resend-confirmation — renvoie l'email de
   * confirmation (mêmes billets en pièce jointe), typiquement demandé
   * juste après une vente sur place si le client n'a rien reçu. Même
   * fonction que celle appelée automatiquement à la vente — best-effort,
   * un échec SMTP est rattrapé par le cron existant, pas remonté ici.
   */
  async resendConfirmation(ctx: HttpContext) {
    const { orgId, role, servicePermissions, serviceIds } = ctx.internalAuth

    const order = await Order.query()
      .where('id', Number(ctx.params.id))
      .where('orgId', orgId)
      .preload('tickets')
      .first()

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

    await sendTicketConfirmationEmail(order, order.tickets)

    return ctx.response.send({ data: { sent: true } })
  }

  /**
   * GET /orders/:id/agent-tickets-pdf — les billets en PDF pour un
   * agent/admin authentifié (ex: réimpression juste après une vente sur
   * place). Distinct de GET /orders/:id/tickets/pdf, qui n'est atteignable
   * qu'avec l'idOp PayFiP (preuve du citoyen) — une vente sur place n'a
   * jamais d'idOp puisqu'il n'y a pas de session PayFiP.
   */
  async agentTicketsPdf(ctx: HttpContext) {
    const { orgId, role, servicePermissions, serviceIds } = ctx.internalAuth

    const order = await Order.query().where('id', Number(ctx.params.id)).where('orgId', orgId).first()

    if (!order) {
      return ctx.response.status(404).send({ error: 'order_not_found' })
    }

    if (!serviceIds?.includes(order.serviceId)) {
      return ctx.response.status(403).send({ error: 'service_not_allowed_for_agent' })
    }

    if (role !== 'admin' && !servicePermissions?.[String(order.serviceId)]?.canSell) {
      return ctx.response.status(403).send({ error: 'permission_required' })
    }

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
  }

  /**
   * POST /orders/scan — un agent scanne le QR de commande (affiché sur la
   * confirmation citoyenne, un seul QR pour tous les billets plutôt qu'un
   * par billet). Renvoie la liste des billets avec, pour chacun, le même
   * code signé qu'un QR individuel (`encodeTicketCode`) — le front les
   * réutilise tels quels contre /tickets/scan pour valider un billet à la
   * fois ou tous d'un coup, sans dupliquer la logique de consommation
   * atomique qui vit déjà là-bas.
   */
  async scanOrder(ctx: HttpContext) {
    const { code } = await ctx.request.validateUsing(scanOrderValidator)
    const { orgId, role, servicePermissions, serviceIds } = ctx.internalAuth

    const orderId = decodeOrderCode(code)
    if (!orderId) {
      return ctx.response.status(422).send({ error: 'invalid_signature' })
    }

    const order = await Order.query().where('id', orderId).where('orgId', orgId).first()
    if (!order) {
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
          code: encodeTicketCode(t.id),
        })),
      },
    })
  }

  /**
   * GET /orders/:id/tickets — récupération des billets une fois la
   * commande confirmée (page de confirmation après achat en ligne).
   */
  async tickets(ctx: HttpContext) {
    const order = await Order.find(Number(ctx.params.id))
    return respondWithOrderTickets(ctx, order)
  }

  /**
   * GET /orders/by-reference/:reference/tickets — même chose, mais pour
   * quand le front n'a que l'idOp au retour de PayFiP : svc-gestion lui
   * renvoie sourceReference (= paymentReference ici), pas notre orderId.
   */
  async ticketsByReference(ctx: HttpContext) {
    const order = await Order.findBy('paymentReference', ctx.params.reference)
    return respondWithOrderTickets(ctx, order)
  }

  /**
   * GET /orders/:id/tickets/:ticketId/pdf — un PDF par billet, même garde
   * idOp+orgId que la lecture des billets.
   */
  async ticketPdf(ctx: HttpContext) {
    const order = await Order.find(Number(ctx.params.id))
    return respondWithTicketPdf(ctx, order, Number(ctx.params.ticketId))
  }

  /**
   * GET /orders/by-reference/:reference/tickets/:ticketId/pdf — même
   * chose, pour le retour PayFiP (le front n'a que sourceReference).
   */
  async ticketPdfByReference(ctx: HttpContext) {
    const order = await Order.findBy('paymentReference', ctx.params.reference)
    return respondWithTicketPdf(ctx, order, Number(ctx.params.ticketId))
  }

  /**
   * GET /orders/:id/tickets/pdf — tous les billets de la commande en un
   * seul PDF (une page par billet), pour le confort d'un seul fichier à
   * sauvegarder/imprimer. Même garde que le PDF à l'unité.
   */
  async ticketsPdf(ctx: HttpContext) {
    const order = await Order.find(Number(ctx.params.id))
    return respondWithOrderTicketsPdf(ctx, order)
  }

  /**
   * GET /orders/by-reference/:reference/tickets/pdf — même chose, pour
   * le retour PayFiP (le front n'a que sourceReference).
   */
  async ticketsPdfByReference(ctx: HttpContext) {
    const order = await Order.findBy('paymentReference', ctx.params.reference)
    return respondWithOrderTicketsPdf(ctx, order)
  }

  /**
   * POST /orders/by-reference/:reference/retry-payment — nouvel essai
   * après un paiement refusé/annulé, sur la page de confirmation où le
   * front n'a que sourceReference + idOp (retour PayFiP). Même garde
   * idOp+orgId que la lecture des billets : c'est la seule preuve
   * disponible que l'appelant est bien l'auteur de CETTE commande.
   *
   * Ne mute jamais l'ancien payment_request : svc-gestion en crée un
   * nouveau (donc un nouvel idOp), la commande est juste repointée dessus
   * — même logique que l'ancienne version 4D.
   */
  async retryPayment(ctx: HttpContext) {
    const order = await Order.findBy('paymentReference', ctx.params.reference)
    const idop = ctx.request.qs().idop
    const { orgId } = ctx.internalAuth

    if (!order || String(order.orgId) !== orgId || !order.payfipIdOp || order.payfipIdOp !== idop) {
      return ctx.response.status(404).send({ error: 'order_not_found' })
    }

    if (order.status !== 'cancelled') {
      return ctx.response.status(409).send({ error: 'order_not_retryable', status: order.status })
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

    return ctx.response.send({
      data: {
        orderId: order.id,
        status: order.status,
        paymentUrl: paymentRequest.paymentUrl,
        payfipIdOp: paymentRequest.payfipIdOp,
      },
    })
  }

  /**
   * POST /payment-webhooks — appelé par svc-gestion (pair à pair, hors
   * Gateway, authentifié par JWT interne — voir internal_jwt_middleware).
   */
  async paymentWebhook(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(paymentWebhookValidator)

    const order = await Order.findBy('paymentReference', payload.sourceReference)
    if (!order) {
      return ctx.response.status(404).send({ error: 'order_not_found' })
    }

    // Raccourci en lecture seule — la vraie garde d'idempotence est
    // l'UPDATE...WHERE conditionnel plus bas, seul point réellement
    // atomique face à deux webhooks concurrents pour la même commande.
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

    if (payload.status === 'paid') {
      // "confirmée" doit toujours vouloir dire "tous les billets payés
      // existent" — sans transaction, un billet qui plante en cours de
      // génération laisserait une commande confirmée avec moins de
      // billets que payés, invisible tant que le citoyen ne s'en aperçoit
      // pas sur place. Le UPDATE...WHERE status='awaiting_payment' est le
      // verrou : si deux webhooks pour la même commande arrivent en même
      // temps (rejeu du job de retry pendant qu'une première livraison
      // lente est encore en cours), un seul gagne la transition et génère
      // les billets — l'autre voit rows.length === 0 et ne fait rien.
      const tickets = await db.transaction(async (trx) => {
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
      }
    } else {
      await db
        .from('orders')
        .where('id', order.id)
        .where('status', 'awaiting_payment')
        .update({ status: 'cancelled', updated_at: DateTime.now().toSQL() })
    }

    return ctx.response.send({ received: true })
  }
}

async function respondWithOrderTickets(ctx: HttpContext, order: Order | null) {
  const idop = ctx.request.qs().idop

  if (!order || !hasOrderAccess(order, ctx.internalAuth.orgId, idop)) {
    return ctx.response.status(404).send({ error: 'order_not_found' })
  }

  const tickets = await Ticket.query().where('orderId', order.id)

  return ctx.response.send({
    data: {
      orderId: order.id,
      status: order.status,
      orderCode: encodeOrderCode(order.id),
      tickets: tickets.map(serializeTicket),
    },
  })
}

async function respondWithTicketPdf(ctx: HttpContext, order: Order | null, ticketId: number) {
  const idop = ctx.request.qs().idop

  if (!order || !hasOrderAccess(order, ctx.internalAuth.orgId, idop)) {
    return ctx.response.status(404).send({ error: 'order_not_found' })
  }

  const ticket = await Ticket.query().where('id', ticketId).where('orderId', order.id).first()
  if (!ticket) {
    return ctx.response.status(404).send({ error: 'ticket_not_found' })
  }

  const pdf = await generateTicketPdf(ticket, order)

  ctx.response.header('Content-Type', 'application/pdf')
  ctx.response.header('Content-Disposition', `attachment; filename="billet-${ticket.id}.pdf"`)
  return ctx.response.send(pdf)
}

async function respondWithOrderTicketsPdf(ctx: HttpContext, order: Order | null) {
  const idop = ctx.request.qs().idop

  if (!order || !hasOrderAccess(order, ctx.internalAuth.orgId, idop)) {
    return ctx.response.status(404).send({ error: 'order_not_found' })
  }

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
}

/**
 * Preuve de possession pour les routes publiques de lecture de billets —
 * en plus de orgId, il faut le payfip_id_op (paiement PayFiP réel) OU
 * l'access_token (généré à la création, seule preuve disponible pour une
 * commande gratuite qui n'a jamais de session PayFiP). Référence seule
 * (BILLxxxxxxxx) est prévisible, ni l'un ni l'autre ne l'est.
 */
function hasOrderAccess(order: Order, orgId: string, idop: unknown): boolean {
  if (String(order.orgId) !== orgId) return false
  if (typeof idop !== 'string' || !idop) return false
  return idop === order.payfipIdOp || idop === order.accessToken
}
