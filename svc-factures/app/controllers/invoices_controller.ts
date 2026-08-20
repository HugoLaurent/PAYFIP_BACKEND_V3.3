import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import Invoice from '#models/invoice'
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

function serializeInvoice(invoice: Invoice, label: string) {
  return {
    id: invoice.id,
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
   * GET /invoices/staff — réservé au staff AREGIE : vue tous organismes
   * pour le dashboard, avec filtres optionnels par organisme/service.
   */
  async staffIndex(ctx: HttpContext) {
    if (ctx.internalAuth.scope !== 'staff') {
      return ctx.response.status(403).send({ error: 'scope_not_allowed' })
    }

    const { orgId, serviceId, status, q, dateFrom, dateTo, page, perPage } =
      await ctx.request.validateUsing(listInvoicesStaffValidator)

    const query = Invoice.query().orderBy('createdAt', 'desc')
    if (orgId) query.where('orgId', orgId)
    if (serviceId) query.where('serviceId', serviceId)
    if (status) query.where('status', status)
    if (q) {
      query.where((sub) => {
        sub.whereILike('hospitalReference', `%${q}%`).orWhereILike('paymentReference', `%${q}%`)
      })
    }
    if (dateFrom) query.where('createdAt', '>=', dateFrom.toJSDate())
    if (dateTo) query.where('createdAt', '<=', dateTo.plus({ days: 1 }).toJSDate())

    const invoices = await query.paginate(page ?? 1, perPage ?? 25)

    return ctx.response.send({
      data: invoices.all().map(serializeInvoiceForStaff),
      meta: invoices.getMeta(),
    })
  }

  /**
   * POST /invoices/verify — l'usager retrouve sa facture avec sa
   * référence, l'année d'exercice et le montant (base légale, seule
   * preuve dont nous disposons). La facture a été déposée par AREGIE en
   * amont : plus aucun appel sortant vers AREGIE ici, on lit notre propre
   * dépôt.
   *
   * Référence introuvable et proof incorrecte renvoient la même erreur,
   * pour ne pas transformer l'endpoint en oracle permettant d'énumérer
   * les factures existantes d'un organisme.
   */
  async verify(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(verifyInvoiceValidator)
    const { orgId } = ctx.internalAuth

    const invoice = await Invoice.query()
      .where('orgId', orgId)
      .where('hospitalReference', payload.hospitalReference)
      .first()

    if (!invoice || !invoiceMatchesProof(invoice, payload)) {
      return ctx.response.status(404).send({ error: 'invoice_not_found_or_proof_mismatch' })
    }

    const label = await resolveInvoiceLabel(orgId, invoice.serviceId)
    return ctx.response.send({ data: serializeInvoice(invoice, label) })
  }

  /**
   * POST /invoices/:id/pay — ouvre la session de paiement pour une
   * facture déjà vérifiée. Refusé si déjà engagée ou soldée.
   *
   * S'ajoute à la preuve référence+année+montant, ne la remplace pas :
   * cette dernière prouve la connaissance de la facture, l'OTP prouve
   * que payerEmail appartient bien à celui qui paie (voir /otp/verify).
   */
  async pay(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(payInvoiceValidator)
    const { orgId } = ctx.internalAuth

    const invoice = await Invoice.find(Number(ctx.params.id))
    if (!invoice || String(invoice.orgId) !== orgId) {
      return ctx.response.status(404).send({ error: 'invoice_not_found' })
    }
    // Sans ce contrôle, connaître un orgId public et un id de facture
    // séquentiel suffirait à engager le paiement de la facture d'autrui,
    // en contournant entièrement /verify.
    if (!invoiceMatchesProof(invoice, payload)) {
      return ctx.response.status(404).send({ error: 'invoice_not_found' })
    }

    const verified = await isEmailVerified(payload.payerEmail)
    if (!verified) return ctx.response.status(403).send({ error: 'email_not_otp_verified' })

    if (invoice.status !== 'draft') {
      return ctx.response.status(409).send({ error: 'invoice_not_payable', status: invoice.status })
    }

    if (!invoice.serviceId) {
      return ctx.response.status(422).send({
        error: 'invoice_without_service',
        detail: "La facture ne désigne aucun service : impossible de savoir quelle régie encaisse.",
      })
    }

    // REFDET : PayFiP exige 6 à 30 caractères alphanumériques sans
    // caractère spécial — d'où le zéro-padding et l'absence de tiret.
    invoice.paymentReference = `FACT${String(invoice.id).padStart(8, '0')}`
    invoice.payerEmail = payload.payerEmail
    await invoice.save()

    let paymentRequest
    try {
      paymentRequest = await createPaymentRequest({
        orgId,
        serviceId: invoice.serviceId,
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

    return ctx.response.status(201).send({
      data: {
        invoiceId: invoice.id,
        status: invoice.status,
        paymentUrl: paymentRequest.paymentUrl,
        payfipIdOp: paymentRequest.payfipIdOp,
      },
    })
  }

  /**
   * GET /invoices/by-reference/:reference — pour la page de confirmation
   * après retour PayFiP, le front n'a que la référence renvoyée par
   * svc-gestion (sourceReference), pas notre id interne.
   */
  async byReference(ctx: HttpContext) {
    const invoice = await Invoice.findBy('paymentReference', ctx.params.reference)
    const idop = ctx.request.qs().idop

    // idOp est l'unique preuve, en plus de orgId, que l'appelant est bien
    // revenu d'un paiement PayFiP réel de CETTE facture — sans quoi une
    // référence prévisible (FACTxxxxxxxx) suffirait à lire le nom, l'email
    // et le montant d'autrui. UUID à 128 bits d'entropie : `!==` suffit.
    if (
      !invoice ||
      String(invoice.orgId) !== ctx.internalAuth.orgId ||
      !invoice.payfipIdOp ||
      invoice.payfipIdOp !== idop
    ) {
      return ctx.response.status(404).send({ error: 'invoice_not_found' })
    }

    const label = await resolveInvoiceLabel(ctx.internalAuth.orgId, invoice.serviceId)
    return ctx.response.send({ data: serializeInvoice(invoice, label) })
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
    const invoice = await Invoice.findBy('paymentReference', ctx.params.reference)
    const idop = ctx.request.qs().idop
    const { orgId } = ctx.internalAuth

    if (
      !invoice ||
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

    if (!invoice.serviceId) {
      return ctx.response.status(422).send({
        error: 'invoice_without_service',
        detail: "La facture ne désigne aucun service : impossible de savoir quelle régie encaisse.",
      })
    }

    const payload = await ctx.request.validateUsing(retryInvoicePaymentValidator)

    let paymentRequest
    try {
      paymentRequest = await retryPaymentRequest(invoice.paymentRequestId!, {
        orgId,
        serviceId: invoice.serviceId,
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

    return ctx.response.send({
      data: {
        invoiceId: invoice.id,
        status: invoice.status,
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

    const invoice = await Invoice.findBy('paymentReference', payload.sourceReference)
    if (!invoice) {
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
    const rows = await db
      .from('invoices')
      .where('id', invoice.id)
      .where('status', 'awaiting_payment')
      .update({ status: nextStatus, updated_at: DateTime.now().toSQL() }, ['*'])

    // Une facture confirmée devient aussi visible dans
    // GET /aregie/invoices/paid, qu'AREGIE viendra collecter — l'email
    // n'est qu'une confirmation immédiate pour le payeur, best-effort.
    if (rows.length > 0 && nextStatus === 'confirmed') {
      invoice.status = nextStatus
      await sendInvoiceConfirmationEmail(invoice)
    }

    return ctx.response.send({ received: true })
  }
}
