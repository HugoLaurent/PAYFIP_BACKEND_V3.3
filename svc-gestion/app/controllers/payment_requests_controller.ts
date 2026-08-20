import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import env from '#start/env'
import payfipClient from '#services/payfip/index'
import PaymentRequest, { type SourceService } from '#models/payment_request'
import { findPayfipAccount, type PayfipAccountLookup } from '#services/svc_auth_client'
import {
  createPaymentRequestValidator,
  listPaymentRequestsStaffValidator,
} from '#validators/payment_request'
import { SOURCE_SERVICES } from '#database/enums'

function isSourceService(value: string): value is SourceService {
  return (SOURCE_SERVICES as readonly string[]).includes(value)
}

function payfipPaymentUrl(idOp: string): string {
  if (env.get('PAYFIP_MODE') === 'fake') {
    return `${env.get('FAKE_PAYFIP_BASE_URL')}/tpa/paiementws.web?idop=${idOp}`
  }
  return `https://www.payfip.gouv.fr/tpa/paiementws.web?idop=${idOp}`
}

function toPublicPayload(paymentRequest: PaymentRequest) {
  return {
    id: paymentRequest.id,
    status: paymentRequest.status,
    payfipIdOp: paymentRequest.payfipIdOp,
    paymentUrl: paymentRequest.payfipIdOp ? payfipPaymentUrl(paymentRequest.payfipIdOp) : null,
    orgId: paymentRequest.orgId,
    sourceService: paymentRequest.sourceService,
    sourceReference: paymentRequest.sourceReference,
  }
}

async function resolvePayableAccount(
  orgId: string,
  serviceId: number
): Promise<{ account: PayfipAccountLookup } | { error: { status: number; body: unknown } }> {
  const account = await findPayfipAccount(orgId, serviceId)

  if (!account) {
    return {
      error: {
        status: 422,
        body: {
          error: 'no_payfip_account_for_service',
          detail: "Aucune régie PayFiP n'est déclarée pour ce service.",
        },
      },
    }
  }

  if (account.status !== 'active') {
    return {
      error: {
        status: 422,
        body: { error: 'service_not_active', detail: `Ce service est ${account.status}.` },
      },
    }
  }

  return { account }
}

export default class PaymentRequestsController {
  /**
   * GET /payment-requests/staff — réservé au staff AREGIE : vue tous
   * organismes pour le dashboard, avec filtres optionnels par
   * organisme/service source.
   */
  async staffIndex(ctx: HttpContext) {
    if (ctx.internalAuth.scope !== 'staff') {
      return ctx.response.status(403).send({ error: 'scope_not_allowed_to_list_payments' })
    }

    const { orgId, sourceService, serviceId, status, q, dateFrom, dateTo, page, perPage } =
      await ctx.request.validateUsing(listPaymentRequestsStaffValidator)

    const query = PaymentRequest.query().orderBy('createdAt', 'desc')
    if (orgId) query.where('orgId', orgId)
    if (sourceService) query.where('sourceService', sourceService)
    if (serviceId) query.where('serviceId', serviceId)
    if (status) query.where('status', status)
    if (q) query.whereILike('sourceReference', `%${q}%`)
    if (dateFrom) query.where('createdAt', '>=', dateFrom.toJSDate())
    if (dateTo) query.where('createdAt', '<=', dateTo.plus({ days: 1 }).toJSDate())

    const paymentRequests = await query.paginate(page ?? 1, perPage ?? 25)

    return ctx.response.send({
      data: paymentRequests.all().map((pr) => ({
        id: pr.id,
        createdAt: pr.createdAt.toISO(),
        orgId: pr.orgId,
        sourceService: pr.sourceService,
        sourceReference: pr.sourceReference,
        serviceId: pr.serviceId,
        amountCents: pr.amountCents,
        status: pr.status,
        payfipIdOp: pr.payfipIdOp,
        paidAt: pr.paidAt?.toISO() ?? null,
      })),
      meta: paymentRequests.getMeta(),
    })
  }

  /**
   * POST /payment-requests
   * Appelé par svc-billetterie / svc-factures via le Gateway.
   */
  async store(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(createPaymentRequestValidator)
    const { orgId, scope } = ctx.internalAuth

    if (!isSourceService(scope)) {
      return ctx.response.status(403).send({ error: 'scope_not_allowed_to_create_payments' })
    }
    const sourceService: SourceService = scope

    // Idempotence à la création : une demande encore vivante (ou déjà
    // payée) pour cette référence est renvoyée telle quelle, PayFiP n'est
    // jamais rappelé. Une ancienne tentative en échec ne compte pas —
    // sinon un deuxième appel après un refus renverrait indéfiniment le
    // même idOp mort (voir aussi retry(), qui gère explicitement ce cas).
    const existing = await PaymentRequest.query()
      .where('sourceService', sourceService)
      .where('sourceReference', payload.sourceReference)
      .whereNotIn('status', PaymentRequest.finalFailureStatuses)
      .first()

    if (existing) {
      return ctx.response.status(200).send({ data: toPublicPayload(existing) })
    }

    const resolved = await resolvePayableAccount(orgId, payload.serviceId)
    if ('error' in resolved) {
      return ctx.response.status(resolved.error.status).send(resolved.error.body)
    }

    const paymentRequest = await PaymentRequest.create({
      orgId,
      sourceService,
      sourceReference: payload.sourceReference,
      serviceId: payload.serviceId,
      exer: payload.exer ?? DateTime.now().year,
      payerEmail: payload.payerEmail,
      numcli: resolved.account.numcli,
      amountCents: payload.amountCents,
      status: 'draft',
      frontRedirectUrl: payload.frontRedirectUrl,
      webhookUrl: payload.webhookUrl,
      retryOfPaymentRequestId: null,
    })

    try {
      await openPayfipSession(paymentRequest, resolved.account, payload.objectLabel)
    } catch (error) {
      // Sans ça, la ligne reste bloquée en 'draft' (payfipIdOp null) —
      // l'idempotence ci-dessus la renverrait indéfiniment telle quelle à
      // tout nouvel essai, sans jamais rappeler PayFiP. 'failed' est
      // exclu de finalFailureStatuses : un essai suivant crée une ligne
      // fraîche, exactement comme prévu pour un refus explicite.
      paymentRequest.status = 'failed'
      await paymentRequest.save()
      throw error
    }

    return ctx.response.status(201).send({ data: toPublicPayload(paymentRequest) })
  }

  /**
   * GET /payfip/status/:idop
   * Interrogé par le front (via le Gateway) — jamais PayFiP directement.
   */
  async status(ctx: HttpContext) {
    const paymentRequest = await PaymentRequest.findBy('payfipIdOp', ctx.params.idop)

    if (!paymentRequest) {
      return ctx.response.status(404).send({ error: 'unknown_idop' })
    }

    return ctx.response.send({ data: toPublicPayload(paymentRequest) })
  }

  /**
   * POST /payment-requests/:id/retry
   * Nouvel essai après un paiement refusé/annulé/expiré — crée une
   * nouvelle demande liée à l'ancienne, ne la mute jamais.
   */
  async retry(ctx: HttpContext) {
    const original = await PaymentRequest.find(Number(ctx.params.id))
    const { orgId, scope } = ctx.internalAuth

    if (!original || original.orgId !== orgId || original.sourceService !== scope) {
      return ctx.response.status(404).send({ error: 'payment_request_not_found' })
    }

    if (!['failed', 'cancelled', 'expired'].includes(original.status)) {
      return ctx.response
        .status(409)
        .send({ error: 'payment_request_not_retryable', status: original.status })
    }

    const payload = await ctx.request.validateUsing(createPaymentRequestValidator)

    const resolved = await resolvePayableAccount(orgId, payload.serviceId)
    if ('error' in resolved) {
      return ctx.response.status(resolved.error.status).send(resolved.error.body)
    }

    const retry = await PaymentRequest.create({
      orgId,
      sourceService: original.sourceService,
      sourceReference: payload.sourceReference,
      serviceId: payload.serviceId,
      exer: payload.exer ?? DateTime.now().year,
      payerEmail: payload.payerEmail,
      numcli: resolved.account.numcli,
      amountCents: payload.amountCents,
      status: 'draft',
      frontRedirectUrl: payload.frontRedirectUrl,
      webhookUrl: payload.webhookUrl,
      retryOfPaymentRequestId: original.id,
    })

    try {
      await openPayfipSession(retry, resolved.account, payload.objectLabel)
    } catch (error) {
      // Même défaut que store() : sans ça, cette tentative de retry reste
      // orpheline en 'draft' — invisible pour l'idempotence mais polluant
      // l'historique des tentatives (attemptsByReference) avec une ligne
      // qui n'aboutira jamais.
      retry.status = 'failed'
      await retry.save()
      throw error
    }

    return ctx.response.status(201).send({ data: toPublicPayload(retry) })
  }

  /**
   * GET /payment-requests/by-reference/:reference
   * Historique complet des tentatives de paiement pour cette référence —
   * appelé en pair-à-pair par svc-billetterie/svc-factures pour répondre à
   * un agent qui doit rassurer un client ("j'ai payé 3 fois, ça a pris ?").
   * Jamais l'idOp ni le montant : un agent n'a besoin que de savoir
   * combien de tentatives, quand, et laquelle a abouti.
   */
  async attemptsByReference(ctx: HttpContext) {
    const { orgId, scope } = ctx.internalAuth

    if (!isSourceService(scope)) {
      return ctx.response.status(403).send({ error: 'scope_not_allowed_to_list_payments' })
    }

    const attempts = await PaymentRequest.query()
      .where('orgId', orgId)
      .where('sourceService', scope)
      .where('sourceReference', ctx.params.reference)
      .orderBy('createdAt', 'asc')

    return ctx.response.send({
      data: attempts.map((pr) => ({
        id: pr.id,
        status: pr.status,
        createdAt: pr.createdAt.toISO(),
        paidAt: pr.paidAt?.toISO() ?? null,
        isRetry: pr.retryOfPaymentRequestId !== null,
      })),
    })
  }
}

/**
 * Ouvre la session PayFiP. Le numcli et le mode de saisie viennent de la
 * régie résolue auprès de svc-auth, jamais de l'appelant : un service
 * compromis ne peut donc pas faire encaisser sur le compte d'un autre.
 */
async function openPayfipSession(
  paymentRequest: PaymentRequest,
  account: PayfipAccountLookup,
  objectLabel: string
) {
  const publicBaseUrl = env.get('PAYFIP_PUBLIC_BASE_URL')

  const { idOp } = await payfipClient.saisiePaiement({
    numcli: account.numcli,
    exer: paymentRequest.exer!,
    amountCents: paymentRequest.amountCents,
    objectLabel,
    reference: paymentRequest.sourceReference,
    payerEmail: paymentRequest.payerEmail!,
    urlNotif: `${publicBaseUrl}/paiement/payfip/notify`,
    urlRedirect: `${publicBaseUrl}/paiement/payfip/return`,
    saisie: account.saisieMode,
  })

  paymentRequest.payfipIdOp = idOp
  paymentRequest.status = 'awaiting_payment'
  // L'idOp n'est utilisable que 15 minutes, pour une seule redirection.
  paymentRequest.expiresAt = DateTime.now().plus({ minutes: 15 })
  await paymentRequest.save()
}
