import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import Invoice from '#models/invoice'
import InvoicePaymentAttempt from '#models/invoice_payment_attempt'
import {
  verifyInvoiceValidator,
  payInvoiceValidator,
  retryInvoicePaymentValidator,
  listInvoicesStaffValidator,
} from '#validators/invoice'
import { paymentWebhookValidator } from '#validators/payment_webhook'
import {
  createPaymentRequest,
  retryPaymentRequest,
  SvcGestionError,
} from '#services/svc_gestion_client'
import { fetchServiceName } from '#services/svc_auth_client'
import { sendInvoiceConfirmationEmail } from '#services/invoice_confirmation_mail_service'
import { isEmailVerified } from '#services/otp_service'
import { notifyOpsAlert } from '#services/ops_alert_service'
import {
  runOnTenant,
  ensureTenantConnectionsForOrg,
  tenantConnectionStorage,
} from '#services/tenant_connection_service'
import { encodeInvoiceCode, decodeInvoiceCode } from '#services/invoice_code_service'

// REFDET PayFiP : 6 à 30 caractères alphanumériques sans caractère
// spécial. Le serviceId est embarqué dans la référence elle-même (largeur
// fixe, donc parsable sans ambiguïté) pour que byReference()/
// retryPayment()/paymentWebhook() routent directement vers la bonne base
// tenant, sans jamais avoir à interroger tous les services d'un
// organisme pour retrouver une facture (voir F3 du plan de migration
// DB-per-tenant — deux services ont chacun leur séquence d'id repartant
// de 1, un id de facture seul ne suffit plus à être unique globalement).
const REFERENCE_SERVICE_ID_WIDTH = 6
const REFERENCE_INVOICE_ID_WIDTH = 8
const PAYMENT_REFERENCE_RE = new RegExp(
  `^FACT(\\d{${REFERENCE_SERVICE_ID_WIDTH}})(\\d{${REFERENCE_INVOICE_ID_WIDTH}})$`
)

function buildPaymentReference(serviceId: number, invoiceId: number): string {
  return `FACT${String(serviceId).padStart(REFERENCE_SERVICE_ID_WIDTH, '0')}${String(
    invoiceId
  ).padStart(REFERENCE_INVOICE_ID_WIDTH, '0')}`
}

function parsePaymentReference(reference: string): { serviceId: number; invoiceId: number } | null {
  const match = PAYMENT_REFERENCE_RE.exec(reference)
  if (!match) return null
  return { serviceId: Number(match[1]), invoiceId: Number(match[2]) }
}

// Le staff connaît déjà le serviceId d'une facture via staffIndex
// (serializeInvoiceForStaff le renvoie) — pas besoin de fan-out ici.
const paymentAttemptsQueryValidator = vine.compile(
  vine.object({
    serviceId: vine.number().positive(),
  })
)

function invoiceMatchesProof(
  invoice: Invoice,
  proof: { fiscalYear: number; amountCents: number }
): boolean {
  return invoice.fiscalYear === proof.fiscalYear && invoice.amountCents === proof.amountCents
}

async function resolveInvoiceLabel(orgId: string, serviceId: number | null): Promise<string> {
  if (!serviceId) return 'Facture'
  const name = await fetchServiceName(orgId, serviceId)
  return name ? `Facture de ${name}` : 'Facture'
}

function serializeInvoice(invoice: Invoice, label: string, serviceId: number) {
  return {
    code: encodeInvoiceCode(serviceId, invoice.id),
    status: invoice.status,
    amountCents: invoice.amountCents,
    objectLabel: label,
    // `?? null` et pas juste la valeur : sur une instance fraîchement créée
    // Lucid laisse les colonnes non renseignées à undefined, que
    // JSON.stringify supprime — le champ disparaîtrait de la réponse.
    clientNumber: invoice.clientNumber ?? null,
    fiscalYear: invoice.fiscalYear,
    payerEmail: invoice.payerEmail ?? null,
    collectedAt: invoice.collectedAt?.toISO() ?? null,
  }
}

/** Vue tous organismes pour le staff — jamais verificationCode. */
function serializeInvoiceForStaff(invoice: Invoice) {
  return {
    id: invoice.id,
    createdAt: invoice.createdAt.toISO(),
    orgId: invoice.orgId,
    serviceId: invoice.serviceId,
    hospitalReference: invoice.hospitalReference,
    paymentReference: invoice.paymentReference,
    status: invoice.status,
    amountCents: invoice.amountCents,
    objectLabel: invoice.objectLabel,
    clientNumber: invoice.clientNumber ?? null,
    collectedAt: invoice.collectedAt?.toISO() ?? null,
  }
}

export default class InvoicesController {
  /**
   * GET /invoices/staff — réservé au staff AREGIE : vue par organisme
   * (orgId obligatoire depuis le split par service — voir
   * listInvoicesStaffValidator) pour le dashboard, filtrable par service.
   * Fan-out borné aux services factures de cet organisme (1 à quelques
   * bases), fusion/tri/pagination en mémoire.
   */
  async staffIndex(ctx: HttpContext) {
    if (ctx.internalAuth.scope !== 'staff') {
      return ctx.response.status(403).send({ error: 'scope_not_allowed' })
    }

    const { orgId, serviceId, status, q, dateFrom, dateTo, page, perPage } =
      await ctx.request.validateUsing(listInvoicesStaffValidator)

    const candidateServiceIds = serviceId ? [serviceId] : await ensureTenantConnectionsForOrg(orgId)

    const matches: Invoice[] = []
    for (const sid of candidateServiceIds) {
      const rows = await runOnTenant(sid, () => {
        const query = Invoice.query().where('orgId', orgId).orderBy('createdAt', 'desc')
        if (status) query.where('status', status)
        if (q) {
          query.where((sub) => {
            sub.whereILike('hospitalReference', `%${q}%`).orWhereILike('paymentReference', `%${q}%`)
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
      data: pageItems.map(serializeInvoiceForStaff),
      meta: {
        total: matches.length,
        perPage: perPageResolved,
        currentPage: pageResolved,
        lastPage: Math.max(1, Math.ceil(matches.length / perPageResolved)),
      },
    })
  }

  /**
   * GET /invoices/staff/:id/payment-attempts — réservé au staff AREGIE.
   * Lu depuis invoice_payment_attempts, jamais depuis svc-gestion (voir
   * échange du 2026-09-03) — le staff obtient déjà serviceId via
   * staffIndex, pas de fan-out ici.
   */
  async paymentAttempts(ctx: HttpContext) {
    if (ctx.internalAuth.scope !== 'staff') {
      return ctx.response.status(403).send({ error: 'scope_not_allowed' })
    }

    const { serviceId } = await paymentAttemptsQueryValidator.validate(ctx.request.qs())
    const invoiceId = Number(ctx.params.id)

    const attempts = await runOnTenant(serviceId, () =>
      InvoicePaymentAttempt.query().where('invoiceId', invoiceId).orderBy('createdAt', 'asc')
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
   * POST /invoices/verify — l'usager retrouve sa facture avec sa
   * référence, l'année d'exercice et le montant (base légale, seule
   * preuve dont nous disposons). La facture a été déposée par AREGIE en
   * amont : plus aucun appel sortant vers AREGIE ici, on lit notre propre
   * dépôt.
   *
   * hospitalReference est une référence externe AREGIE, pas encodable
   * dans une base tenant précise : fan-out borné à l'organisme (1 à
   * quelques services). Si plusieurs services du même organisme portent
   * la même hospitalReference, échec fermé + alerte ops plutôt qu'un
   * choix silencieux — c'est un signal d'intégrité de données, pas un cas
   * à couvrir en silence.
   *
   * Référence introuvable et proof incorrecte renvoient la même erreur,
   * pour ne pas transformer l'endpoint en oracle permettant d'énumérer
   * les factures existantes d'un organisme.
   */
  async verify(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(verifyInvoiceValidator)
    const orgIdStr = ctx.internalAuth.orgId
    const orgId = Number(orgIdStr)

    const serviceIds = await ensureTenantConnectionsForOrg(orgId)

    const matches: { serviceId: number; invoice: Invoice }[] = []
    for (const serviceId of serviceIds) {
      const invoice = await runOnTenant(serviceId, () =>
        Invoice.query()
          .where('orgId', orgId)
          .where('hospitalReference', payload.hospitalReference)
          .first()
      )
      if (invoice && invoiceMatchesProof(invoice, payload)) {
        matches.push({ serviceId, invoice })
      }
    }

    if (matches.length === 0) {
      return ctx.response.status(404).send({ error: 'invoice_not_found_or_proof_mismatch' })
    }

    if (matches.length > 1) {
      const conflictingServiceIds = matches.map((m) => m.serviceId)
      logger.error(
        { orgId, hospitalReference: payload.hospitalReference, conflictingServiceIds },
        'verify(): hospitalReference dupliquée entre plusieurs services du même organisme'
      )
      await notifyOpsAlert(
        'Référence facture dupliquée entre services',
        `orgId=${orgId} hospitalReference=${payload.hospitalReference} présente dans les services ${conflictingServiceIds.join(', ')} — échec fermé, aucune facture retournée.`
      )
      return ctx.response.status(404).send({ error: 'invoice_not_found_or_proof_mismatch' })
    }

    const { serviceId, invoice } = matches[0]
    const label = await resolveInvoiceLabel(orgIdStr, serviceId)
    return ctx.response.send({ data: serializeInvoice(invoice, label, serviceId) })
  }

  /**
   * POST /invoices/:code/pay — ouvre la session de paiement pour une
   * facture déjà vérifiée. Refusé si déjà engagée ou soldée.
   *
   * :code est le code opaque renvoyé par verify() (voir
   * invoice_code_service.ts), pas l'id brut de la facture : celui-ci
   * n'est plus unique globalement depuis le split par service.
   *
   * S'ajoute à la preuve référence+année+montant, ne la remplace pas :
   * cette dernière prouve la connaissance de la facture, l'OTP prouve
   * que payerEmail appartient bien à celui qui paie (voir /otp/verify).
   */
  async pay(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(payInvoiceValidator)
    const { orgId } = ctx.internalAuth

    const decoded = decodeInvoiceCode(ctx.params.code)
    if (!decoded) {
      return ctx.response.status(404).send({ error: 'invoice_not_found' })
    }

    return runOnTenant(decoded.serviceId, async () => {
      const invoice = await Invoice.find(decoded.invoiceId)
      // invoice.serviceId doit correspondre à la base tenant qu'on vient
      // d'interroger — sans ce contrôle, un code opaque forgé pour un
      // serviceId A mais désignant un invoiceId qui existe aussi (par
      // coïncidence d'id) dans la base d'un serviceId B ne serait jamais
      // détecté (Invoice.find() ne regarde que la base connectée, pas la
      // colonne serviceId elle-même).
      if (
        !invoice ||
        invoice.serviceId !== decoded.serviceId ||
        String(invoice.orgId) !== orgId
      ) {
        return ctx.response.status(404).send({ error: 'invoice_not_found' })
      }
      // Sans ce contrôle, connaître un orgId public et un code de facture
      // suffirait à engager le paiement de la facture d'autrui, en
      // contournant entièrement /verify.
      if (!invoiceMatchesProof(invoice, payload)) {
        return ctx.response.status(404).send({ error: 'invoice_not_found' })
      }

      const verified = await isEmailVerified(payload.payerEmail)
      if (!verified) return ctx.response.status(403).send({ error: 'email_not_otp_verified' })

      if (invoice.status !== 'draft') {
        return ctx.response
          .status(409)
          .send({ error: 'invoice_not_payable', status: invoice.status })
      }

      invoice.paymentReference = buildPaymentReference(decoded.serviceId, invoice.id)
      invoice.payerEmail = payload.payerEmail
      await invoice.save()

      let paymentRequest
      try {
        paymentRequest = await createPaymentRequest({
          orgId,
          serviceId: decoded.serviceId,
          sourceReference: invoice.paymentReference,
          amountCents: invoice.amountCents,
          // OBJET générique, jamais le libellé déposé par AREGIE : celui-ci
          // peut décrire un acte médical, et l'OBJET PayFiP finit
          // potentiellement sur le relevé bancaire du payeur (visible par
          // d'autres que lui). Même principe que l'ancien 4D, qui envoyait
          // toujours la constante "vente" pour la billetterie.
          objectLabel: 'Paiement de facture',
          payerEmail: payload.payerEmail,
          exer: invoice.fiscalYear,
          frontRedirectUrl: payload.frontRedirectUrl,
        })
      } catch (error) {
        // Un refus de svc-gestion est une réponse métier, pas une panne :
        // on le retransmet tel quel plutôt que de le laisser devenir un 500.
        if (error instanceof SvcGestionError && error.status < 500) {
          return ctx.response.status(error.status).send(error.body)
        }
        throw error
      }

      invoice.paymentRequestId = paymentRequest.id
      invoice.payfipIdOp = paymentRequest.payfipIdOp
      invoice.status = 'awaiting_payment'
      await invoice.save()

      await InvoicePaymentAttempt.create({
        invoiceId: invoice.id,
        paymentRequestId: paymentRequest.id,
        status: 'awaiting_payment',
        isRetry: false,
      })

      return ctx.response.status(201).send({
        data: {
          status: invoice.status,
          paymentUrl: paymentRequest.paymentUrl,
          payfipIdOp: paymentRequest.payfipIdOp,
        },
      })
    })
  }

  /**
   * GET /invoices/by-reference/:reference — pour la page de confirmation
   * après retour PayFiP, le front n'a que la référence renvoyée par
   * svc-gestion (sourceReference), pas notre id interne. Le serviceId est
   * encodé dans la référence elle-même (voir buildPaymentReference) —
   * routage direct vers la bonne base tenant, aucun fan-out.
   */
  async byReference(ctx: HttpContext) {
    const parsed = parsePaymentReference(ctx.params.reference)
    if (!parsed) {
      return ctx.response.status(404).send({ error: 'invoice_not_found' })
    }

    const idop = ctx.request.qs().idop
    const { orgId } = ctx.internalAuth

    return runOnTenant(parsed.serviceId, async () => {
      const invoice = await Invoice.find(parsed.invoiceId)

      // idOp est l'unique preuve, en plus de orgId, que l'appelant est bien
      // revenu d'un paiement PayFiP réel de CETTE facture — sans quoi une
      // référence prévisible (FACTxxxxxxxxxxxxxx) suffirait à lire le nom,
      // l'email et le montant d'autrui. UUID à 128 bits d'entropie : `!==`
      // suffit.
      if (
        !invoice ||
        invoice.paymentReference !== ctx.params.reference ||
        String(invoice.orgId) !== orgId ||
        !invoice.payfipIdOp ||
        invoice.payfipIdOp !== idop
      ) {
        return ctx.response.status(404).send({ error: 'invoice_not_found' })
      }

      const label = await resolveInvoiceLabel(orgId, invoice.serviceId)
      return ctx.response.send({ data: serializeInvoice(invoice, label, parsed.serviceId) })
    })
  }

  /**
   * POST /invoices/by-reference/:reference/retry-payment — nouvel essai
   * après un paiement refusé/annulé, sur la page de confirmation où le
   * front n'a que sourceReference + idOp (retour PayFiP). Même garde
   * idOp+orgId que byReference : l'idOp (128 bits) est une preuve plus
   * forte que la base légale, pas besoin de la redemander.
   *
   * Ne mute jamais l'ancien payment_request : svc-gestion en crée un
   * nouveau (donc un nouvel idOp), la facture est juste repointée dessus.
   */
  async retryPayment(ctx: HttpContext) {
    const parsed = parsePaymentReference(ctx.params.reference)
    if (!parsed) {
      return ctx.response.status(404).send({ error: 'invoice_not_found' })
    }

    const idop = ctx.request.qs().idop
    const { orgId } = ctx.internalAuth

    return runOnTenant(parsed.serviceId, async () => {
      const invoice = await Invoice.find(parsed.invoiceId)

      if (
        !invoice ||
        invoice.paymentReference !== ctx.params.reference ||
        String(invoice.orgId) !== orgId ||
        !invoice.payfipIdOp ||
        invoice.payfipIdOp !== idop
      ) {
        return ctx.response.status(404).send({ error: 'invoice_not_found' })
      }

      if (invoice.status !== 'cancelled') {
        return ctx.response
          .status(409)
          .send({ error: 'invoice_not_retryable', status: invoice.status })
      }

      const payload = await ctx.request.validateUsing(retryInvoicePaymentValidator)

      let paymentRequest
      try {
        paymentRequest = await retryPaymentRequest(invoice.paymentRequestId!, {
          orgId,
          serviceId: parsed.serviceId,
          sourceReference: invoice.paymentReference!,
          amountCents: invoice.amountCents,
          objectLabel: 'Paiement de facture',
          payerEmail: invoice.payerEmail!,
          exer: invoice.fiscalYear,
          frontRedirectUrl: payload.frontRedirectUrl,
        })
      } catch (error) {
        if (error instanceof SvcGestionError && error.status < 500) {
          return ctx.response.status(error.status).send(error.body)
        }
        throw error
      }

      invoice.paymentRequestId = paymentRequest.id
      invoice.payfipIdOp = paymentRequest.payfipIdOp
      invoice.status = 'awaiting_payment'
      await invoice.save()

      await InvoicePaymentAttempt.create({
        invoiceId: invoice.id,
        paymentRequestId: paymentRequest.id,
        status: 'awaiting_payment',
        isRetry: true,
      })

      return ctx.response.send({
        data: {
          status: invoice.status,
          paymentUrl: paymentRequest.paymentUrl,
          payfipIdOp: paymentRequest.payfipIdOp,
        },
      })
    })
  }

  /**
   * POST /payment-webhooks — appelé par svc-gestion (pair à pair, hors
   * Gateway, authentifié par JWT interne — voir internal_jwt_middleware).
   * sourceReference porte le serviceId (voir buildPaymentReference) :
   * routage direct, aucun fan-out.
   */
  async paymentWebhook(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(paymentWebhookValidator)

    const parsed = parsePaymentReference(payload.sourceReference)
    if (!parsed) {
      return ctx.response.status(404).send({ error: 'invoice_not_found' })
    }

    return runOnTenant(parsed.serviceId, async () => {
      const invoice = await Invoice.find(parsed.invoiceId)
      if (!invoice || invoice.paymentReference !== payload.sourceReference) {
        return ctx.response.status(404).send({ error: 'invoice_not_found' })
      }

      // Raccourci en lecture seule — la vraie garde d'idempotence est
      // l'UPDATE...WHERE conditionnel plus bas, seul point réellement
      // atomique face à deux webhooks concurrents pour la même facture.
      if (invoice.status !== 'awaiting_payment') {
        return ctx.response.send({ received: true, alreadyProcessed: true })
      }

      if (
        payload.amountCents !== invoice.amountCents ||
        payload.paymentRequestId !== invoice.paymentRequestId
      ) {
        logger.warn(
          { invoiceId: invoice.id, payload },
          'paymentWebhook rejeté — montant ou paymentRequestId incohérent'
        )
        return ctx.response.status(422).send({ error: 'payment_webhook_mismatch' })
      }

      const nextStatus = payload.status === 'paid' ? 'confirmed' : 'cancelled'
      const connectionName = tenantConnectionStorage.getStore()!
      const rows = await db
        .connection(connectionName)
        .from('invoices')
        .where('id', invoice.id)
        .where('status', 'awaiting_payment')
        .update({ status: nextStatus, updated_at: DateTime.now().toSQL() }, ['*'])

      if (rows.length > 0) {
        await InvoicePaymentAttempt.query()
          .where('invoiceId', invoice.id)
          .where('paymentRequestId', payload.paymentRequestId)
          .update({
            status: payload.status,
            paidAt: payload.status === 'paid' ? DateTime.now().toSQL() : undefined,
          })
      }

      // Une facture confirmée devient aussi visible dans
      // GET /aregie/invoices/paid, qu'AREGIE viendra collecter — l'email
      // n'est qu'une confirmation immédiate pour le payeur, best-effort.
      if (rows.length > 0 && nextStatus === 'confirmed') {
        invoice.status = nextStatus
        await sendInvoiceConfirmationEmail(invoice)
      }

      // Démo commerciale (widget "Facture", voir gateway/demo_controller.ts) :
      // une seule facture démo existe (DEMO-2026-001) — remise à l'état
      // "draft" quelques instants après paiement pour que plusieurs
      // visiteurs puissent tester le parcours de suite, sans qu'un agent
      // n'ait à la réinitialiser à la main entre deux démos. Le délai
      // laisse le temps au payeur de voir sa propre page de confirmation
      // avant que la facture ne redevienne payable. Jamais pour une
      // facture réelle : hospitalReference est comparée à une valeur figée.
      if (rows.length > 0 && nextStatus === 'confirmed' && invoice.hospitalReference === 'DEMO-2026-001') {
        setTimeout(() => {
          db.connection(connectionName)
            .from('invoices')
            .where('id', invoice.id)
            .update({
              status: 'draft',
              payment_request_id: null,
              payfip_idop: null,
              payment_reference: null,
              payer_email: null,
              deposited_at: null,
              collected_at: null,
              updated_at: DateTime.now().toSQL(),
            })
            .catch((error) => logger.error({ err: error }, 'échec de la remise à zéro de la facture démo'))
        }, 90_000)
      }

      return ctx.response.send({ received: true })
    })
  }
}
