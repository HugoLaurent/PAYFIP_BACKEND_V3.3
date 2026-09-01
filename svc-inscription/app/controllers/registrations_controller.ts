import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Event from '#models/event'
import type { FormField, DocumentRequirement } from '#models/event'
import Registration from '#models/registration'
import RegistrationDocument from '#models/registration_document'
import {
  createRegistrationValidator,
  listRegistrationsValidator,
  reviewRegistrationValidator,
  retryRegistrationPaymentValidator,
  payRegistrationValidator,
} from '#validators/registration'
import { paymentWebhookValidator } from '#validators/payment_webhook'
import { isEmailVerified } from '#services/otp_service'
import { checkCapacity } from '#services/capacity_service'
import { promoteNextWaitlisted } from '#services/waitlist_service'
import {
  createPaymentRequest,
  retryPaymentRequest,
  SvcGestionError,
} from '#services/svc_gestion_client'
import { processDocument } from '#services/document_processing_service'
import { generateRegistrationAttestationPdf } from '#services/attestation_pdf_service'
import { agentLabel } from '#services/agent_label_service'
import {
  sendRegistrationConfirmationEmail,
  sendPaymentRequestEmail,
  sendRegistrationRejectionEmail,
  notifyAgentsOfPendingReview,
} from '#services/registration_mail_service'

// Documents : PDF/PNG/JPEG, 8 Mo/fichier — un fichier par exigence nommée
// (voir Event.DocumentRequirement, plafonné à 5 par événement côté
// validators/event.ts).
const DOCUMENT_MAX_SIZE = '8mb'
const DOCUMENT_EXTNAMES = ['pdf', 'png', 'jpg', 'jpeg']
const DOCUMENT_ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg']

// Re-dépôt après rejet : le citoyen dispose de 7 jours avant que la place
// soit libérée (valeur exacte laissée à trancher avec l'agent/produit,
// voir plan §3 — 7 jours est un choix raisonnable, ni trop court pour
// rassembler un nouveau justificatif, ni trop long pour bloquer la file
// d'attente).
const DOCUMENT_RESUBMIT_DEADLINE_DAYS = 7

// Délai minimum entre deux clics sur "Relancer" (voir #resendReminder) —
// garde-fou anti-spam, pas une vraie limite métier : assez court pour
// rester utile le jour même, assez long pour qu'un double-clic ou un agent
// impatient n'inonde pas le citoyen.
const REMINDER_COOLDOWN_MINUTES = 15

function eventRequiresDocuments(event: Event): boolean {
  return (event.documentRequirements?.length ?? 0) > 0
}

function validateFormResponses(
  formSchema: FormField[] | null,
  formResponses: Record<string, unknown> | null | undefined
): string | null {
  if (!formSchema || formSchema.length === 0) return null

  const responses = formResponses ?? {}
  for (const field of formSchema) {
    const value = responses[field.key]
    const isEmpty = value === undefined || value === null || value === ''

    if (field.required && isEmpty) {
      return `missing_required_field:${field.key}`
    }
    if (isEmpty) continue

    switch (field.type) {
      case 'choice':
        if (typeof value !== 'string' || (field.options && !field.options.includes(value))) {
          return `invalid_choice:${field.key}`
        }
        break
      case 'checkbox':
        if (typeof value !== 'boolean') return `invalid_checkbox:${field.key}`
        break
      case 'number':
        if (typeof value !== 'number' || Number.isNaN(value)) return `invalid_number:${field.key}`
        break
      case 'date':
        if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
          return `invalid_date:${field.key}`
        }
        break
      case 'short_text':
      case 'long_text':
        if (typeof value !== 'string') return `invalid_text:${field.key}`
        break
    }
  }

  return null
}

function serializeRegistrationForCitizen(registration: Registration, event: Event) {
  const now = DateTime.now()
  return {
    id: registration.id,
    status: registration.status,
    eventId: event.id,
    eventTitle: event.title,
    eventDate: event.eventDate?.toISODate() ?? null,
    firstName: registration.firstName,
    lastName: registration.lastName,
    email: registration.email,
    quantity: registration.quantity,
    amountCents: registration.priceCentsAtRegistration,
    paymentMethod: registration.paymentMethod,
    registrationReference: registration.paymentReference ?? String(registration.id),
    rejectionReason: registration.rejectionReason,
    // Cité tel quel côté citoyen (voir maquette écran E3) : le motif
    // n'est jamais reformulé par le système, daté et signé du service qui
    // l'a écrit.
    reviewedByLabel: registration.reviewedByLabel,
    reviewedAt: registration.reviewedAt?.toISO() ?? null,
    documentDeadlineAt: registration.documentDeadlineAt?.toISO() ?? null,
    // Distingue "vos documents sont refusés" de "il ne manque qu'un
    // complément" côté citoyen — voir RegistrationRejected.tsx.
    keepExistingDocuments: registration.keepExistingDocuments,
    // Pour afficher les mêmes slots de dépôt nommés qu'à l'inscription
    // initiale sur l'écran de redépôt (voir RegistrationRejected.tsx).
    documentRequirements: event.documentRequirements,
    waitlistPosition: registration.waitlistPosition,
    waitlistNotifiedAt: registration.waitlistNotifiedAt?.toISO() ?? null,
    waitlistResponseDeadline: registration.waitlistResponseDeadline?.toISO() ?? null,
    cancelledAt: registration.cancelledAt?.toISO() ?? null,
    createdAt: registration.createdAt.toISO(),
    canCancel:
      !['cancelled', 'expired'].includes(registration.status) &&
      (!event.registrationDeadline || event.registrationDeadline > now),
    canPay: registration.status === 'awaiting_payment',
    // Confirmer une offre de liste d'attente active réutilise l'action
    // "payer maintenant" côté payant — voir payByToken. Côté gratuit, la
    // même route confirme directement sans session PayFiP.
    canConfirmWaitlistOffer:
      registration.status === 'waitlisted' &&
      registration.waitlistNotifiedAt !== null &&
      (registration.waitlistResponseDeadline === null || registration.waitlistResponseDeadline > now),
    canRetryPayment: registration.status === 'cancelled' && registration.payfipIdOp !== null,
    canReplaceDocuments:
      registration.status === 'rejected' &&
      (!registration.documentDeadlineAt || registration.documentDeadlineAt > now),
    canDownloadAttestation: registration.status === 'confirmed',
  }
}

function serializeRegistrationForAgent(registration: Registration) {
  return {
    id: registration.id,
    status: registration.status,
    firstName: registration.firstName,
    lastName: registration.lastName,
    email: registration.email,
    quantity: registration.quantity,
    formResponses: registration.formResponses,
    amountCents: registration.priceCentsAtRegistration,
    paymentMethod: registration.paymentMethod,
    registrationReference: registration.paymentReference ?? String(registration.id),
    rejectionReason: registration.rejectionReason,
    documentDeadlineAt: registration.documentDeadlineAt?.toISO() ?? null,
    keepExistingDocuments: registration.keepExistingDocuments,
    waitlistPosition: registration.waitlistPosition,
    reviewedByLabel: registration.reviewedByLabel,
    reviewedAt: registration.reviewedAt?.toISO() ?? null,
    cancelledAt: registration.cancelledAt?.toISO() ?? null,
    createdAt: registration.createdAt.toISO(),
    documents: registration.documents?.map((d) => ({
      id: d.id,
      documentKey: d.documentKey,
      filename: d.filename,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      isCurrent: d.isCurrent,
      createdAt: d.createdAt.toISO(),
    })),
  }
}

/**
 * Preuve de possession pour les routes `by-token/*` : l'accessToken seul,
 * plus l'appartenance à l'organisme du JWT interne (défense en
 * profondeur — le token en lui-même est déjà la preuve principale, non
 * devinable).
 */
async function findRegistrationByAccessToken(
  orgId: string,
  accessToken: string
): Promise<{ registration: Registration; event: Event } | null> {
  const registration = await Registration.query()
    .where('accessToken', accessToken)
    .where('orgId', orgId)
    .first()

  if (!registration) return null

  const event = await Event.find(registration.eventId)
  if (!event) return null

  return { registration, event }
}

/**
 * Preuve de possession équivalente à findRegistrationByAccessToken, mais
 * pour le retour navigateur PayFiP : à cet instant le front ne connaît
 * que `sourceReference`/`idop` (ajoutés par svc-gestion à frontRedirectUrl,
 * voir payfip_callbacks_controller.ts côté svc-gestion), jamais
 * l'accessToken (impossible de le connaître avant la création de
 * l'inscription elle-même, qui a lieu dans la même requête que l'appel à
 * createPaymentRequest). Même garde que hasOrderAccess côté
 * svc-billetterie : idop doit matcher payfipIdOp OU accessToken.
 */
function hasRegistrationAccess(registration: Registration, orgId: string, idop: unknown): boolean {
  if (String(registration.orgId) !== orgId) return false
  if (typeof idop !== 'string' || !idop) return false
  return idop === registration.payfipIdOp || idop === registration.accessToken
}

export default class RegistrationsController {
  /**
   * GET /registrations/by-reference/:reference — lecture par preuve
   * idop (retour PayFiP), pas par accessToken. Renvoie la même forme que
   * showByToken, y compris l'accessToken lui-même une fois la preuve
   * validée : le front peut ensuite continuer via les routes by-token/*
   * habituelles (annulation, paiement, attestation...).
   */
  async showByReference(ctx: HttpContext) {
    const registration = await Registration.findBy('paymentReference', ctx.params.reference)
    const idop = ctx.request.qs().idop
    if (!registration || !hasRegistrationAccess(registration, ctx.internalAuth.orgId, idop)) {
      return ctx.response.status(404).send({ error: 'registration_not_found' })
    }
    const event = await Event.find(registration.eventId)
    if (!event) return ctx.response.status(404).send({ error: 'registration_not_found' })

    return ctx.response.send({
      data: { ...serializeRegistrationForCitizen(registration, event), accessToken: registration.accessToken },
    })
  }


  /**
   * POST /registrations — inscription simple (sans justificatif), JSON.
   * L'email doit avoir été vérifié par OTP juste avant. Un évènement
   * complet ne refuse jamais : la place passe en liste d'attente (voir
   * capacity_service).
   */
  async store(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(createRegistrationValidator)
    const { orgId } = ctx.internalAuth

    const verified = await isEmailVerified(payload.email)
    if (!verified) return ctx.response.status(403).send({ error: 'email_not_otp_verified' })

    const event = await Event.query()
      .where('id', payload.eventId)
      .where('orgId', orgId)
      .where('status', 'published')
      .first()
    if (!event) return ctx.response.status(404).send({ error: 'event_not_found' })

    if (eventRequiresDocuments(event)) {
      return ctx.response.status(422).send({ error: 'documents_required' })
    }

    if (event.registrationDeadline && event.registrationDeadline < DateTime.now()) {
      return ctx.response.status(422).send({ error: 'registration_closed' })
    }

    const quantity = payload.quantity ?? 1
    if (quantity > event.maxParticipantsPerRegistration) {
      return ctx.response.status(422).send({ error: 'quantity_exceeds_max' })
    }

    const formError = validateFormResponses(event.formSchema, payload.formResponses)
    if (formError) {
      return ctx.response.status(422).send({ error: 'invalid_form_responses', detail: formError })
    }

    return this.createRegistrationAndRespond(ctx, event, {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      quantity,
      formResponses: payload.formResponses ?? null,
      frontRedirectUrl: payload.frontRedirectUrl,
    })
  }

  /**
   * POST /registrations/with-documents — inscription avec dépôt de
   * justificatifs, multipart. Les champs scalaires sont lus et validés à
   * la main (pas de vine sur un body multipart, comme uploadLogo côté
   * svc-auth) ; `formResponses`, s'il existe, est transmis en JSON string
   * dans un champ du même nom.
   */
  async storeWithDocuments(ctx: HttpContext) {
    const { orgId } = ctx.internalAuth

    const fields = ctx.request.only([
      'email',
      'firstName',
      'lastName',
      'eventId',
      'quantity',
      'formResponses',
      'frontRedirectUrl',
    ])

    const email = typeof fields.email === 'string' ? fields.email.trim() : ''
    const firstName = typeof fields.firstName === 'string' ? fields.firstName.trim() : ''
    const lastName = typeof fields.lastName === 'string' ? fields.lastName.trim() : ''
    const eventId = Number(fields.eventId)
    const quantity = fields.quantity ? Number(fields.quantity) : 1
    const frontRedirectUrl = typeof fields.frontRedirectUrl === 'string' ? fields.frontRedirectUrl : ''

    if (!email || !firstName || !lastName || !Number.isFinite(eventId) || !frontRedirectUrl) {
      return ctx.response.status(422).send({ error: 'invalid_payload' })
    }

    let formResponses: Record<string, unknown> | null = null
    if (typeof fields.formResponses === 'string' && fields.formResponses.length > 0) {
      try {
        formResponses = JSON.parse(fields.formResponses)
      } catch {
        return ctx.response.status(422).send({ error: 'invalid_form_responses', detail: 'not_json' })
      }
    }

    const verified = await isEmailVerified(email)
    if (!verified) return ctx.response.status(403).send({ error: 'email_not_otp_verified' })

    const event = await Event.query()
      .where('id', eventId)
      .where('orgId', orgId)
      .where('status', 'published')
      .first()
    if (!event) return ctx.response.status(404).send({ error: 'event_not_found' })

    if (event.registrationDeadline && event.registrationDeadline < DateTime.now()) {
      return ctx.response.status(422).send({ error: 'registration_closed' })
    }

    if (quantity > event.maxParticipantsPerRegistration) {
      return ctx.response.status(422).send({ error: 'quantity_exceeds_max' })
    }

    const formError = validateFormResponses(event.formSchema, formResponses)
    if (formError) {
      return ctx.response.status(422).send({ error: 'invalid_form_responses', detail: formError })
    }

    const requirements = event.documentRequirements ?? []
    if (requirements.length === 0) {
      return ctx.response.status(422).send({ error: 'documents_not_required' })
    }

    const result = await this.readNamedDocuments(ctx, requirements, { requireAll: true })
    if (!result.ok) return ctx.response.status(result.status).send(result.body)

    return this.createRegistrationAndRespond(
      ctx,
      event,
      { firstName, lastName, email, quantity, formResponses, frontRedirectUrl },
      result.documents
    )
  }

  /**
   * Lit, valide et traite un fichier par exigence nommée (voir
   * Event.DocumentRequirement) — un slot de dépôt distinct par pièce,
   * jamais un champ générique unique. `requireAll` impose la présence de
   * chaque exigence `required` (inscription initiale, ou redépôt après un
   * vrai rejet où tous les anciens documents sont invalidés) ; à `false`
   * (complément demandé, documents existants conservés), au moins un
   * fichier suffit — voir replaceDocuments.
   */
  private async readNamedDocuments(
    ctx: HttpContext,
    requirements: DocumentRequirement[],
    options: { requireAll: boolean }
  ): Promise<
    | { ok: true; documents: Array<{ key: string; filename: string; mimeType: string; data: Buffer }> }
    | { ok: false; status: number; body: Record<string, unknown> }
  > {
    const documents: Array<{ key: string; filename: string; mimeType: string; data: Buffer }> = []

    for (const req of requirements) {
      const file = ctx.request.file(req.key, { size: DOCUMENT_MAX_SIZE, extnames: DOCUMENT_EXTNAMES })
      if (!file) {
        if (options.requireAll && req.required) {
          return { ok: false, status: 422, body: { error: 'document_required', detail: req.key } }
        }
        continue
      }
      if (!file.isValid) {
        return { ok: false, status: 422, body: { error: 'invalid_document', detail: file.errors } }
      }
      const mimeType = `${file.type}/${file.subtype}`
      if (!DOCUMENT_ALLOWED_MIME_TYPES.includes(mimeType)) {
        return { ok: false, status: 422, body: { error: 'invalid_document', detail: 'unsupported_type' } }
      }
      const original = await readFile(file.tmpPath!)
      const processed = await processDocument(original, mimeType)
      if (!processed) {
        return { ok: false, status: 422, body: { error: 'invalid_document', detail: 'unsupported_type' } }
      }
      documents.push({ key: req.key, filename: file.clientName, mimeType: processed.mimeType, data: processed.data })
    }

    if (documents.length === 0) {
      return { ok: false, status: 422, body: { error: 'documents_required' } }
    }

    return { ok: true, documents }
  }

  /**
   * Logique commune à store()/storeWithDocuments() : vérification de
   * capacité (liste d'attente si complet — voir plan §0bis point 1 et
   * parcours D), puis branche gratuit/payant (parcours A/B/C).
   */
  private async createRegistrationAndRespond(
    ctx: HttpContext,
    event: Event,
    input: {
      firstName: string
      lastName: string
      email: string
      quantity: number
      formResponses: Record<string, unknown> | null
      frontRedirectUrl: string
    },
    documents?: Array<{ key: string; filename: string; mimeType: string; data: Buffer }>
  ) {
    const { orgId } = ctx.internalAuth
    const totalPriceCents = event.priceCents * input.quantity
    const capacityCheck = await checkCapacity(event, input.quantity)

    if (!capacityCheck.fits) {
      const registration = await db.transaction(async (trx) => {
        const r = await Registration.create(
          {
            orgId: Number(orgId),
            serviceId: event.serviceId,
            eventId: event.id,
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
            quantity: input.quantity,
            formResponses: input.formResponses,
            status: 'waitlisted',
            priceCentsAtRegistration: totalPriceCents,
            paymentMethod: totalPriceCents === 0 ? 'free' : 'payfip',
            accessToken: randomUUID(),
            waitlistPosition: capacityCheck.waitlistPosition,
            otpVerifiedAt: DateTime.now(),
          },
          { client: trx }
        )
        if (documents) {
          await this.storeDocuments(r.id, documents, trx)
        }
        return r
      })

      return ctx.response.status(201).send({
        data: {
          registrationId: registration.id,
          status: registration.status,
          waitlistPosition: registration.waitlistPosition,
          accessToken: registration.accessToken,
        },
      })
    }

    const isFree = totalPriceCents === 0
    // Avec justificatifs : toujours awaiting_review d'abord, quel que soit
    // le prix — la confirmation/demande de paiement n'arrive qu'après
    // validation par l'agent (parcours C). Sans justificatif : statut
    // final immédiat (parcours A/B).
    const initialStatus = eventRequiresDocuments(event) ? 'awaiting_review' : isFree ? 'confirmed' : 'awaiting_payment'

    const registration = await db.transaction(async (trx) => {
      const r = await Registration.create(
        {
          orgId: Number(orgId),
          serviceId: event.serviceId,
          eventId: event.id,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          quantity: input.quantity,
          formResponses: input.formResponses,
          status: initialStatus,
          priceCentsAtRegistration: totalPriceCents,
          paymentMethod: isFree ? 'free' : 'payfip',
          accessToken: randomUUID(),
          otpVerifiedAt: DateTime.now(),
        },
        { client: trx }
      )
      r.paymentReference = `INSC${String(r.id).padStart(8, '0')}`
      await r.useTransaction(trx).save()

      if (documents) {
        await this.storeDocuments(r.id, documents, trx)
      }
      return r
    })

    if (eventRequiresDocuments(event)) {
      // awaiting_review : l'agent doit d'abord valider les justificatifs
      // avant tout email/paiement (parcours C).
      await notifyAgentsOfPendingReview(registration, event)
      return ctx.response.status(201).send({
        data: {
          registrationId: registration.id,
          status: registration.status,
          accessToken: registration.accessToken,
        },
      })
    }

    if (isFree) {
      await sendRegistrationConfirmationEmail(registration, event)
      return ctx.response.status(201).send({
        data: {
          registrationId: registration.id,
          status: registration.status,
          accessToken: registration.accessToken,
          free: true,
        },
      })
    }

    // Payant, sans justificatif (parcours B) : la session PayFiP est créée
    // tout de suite (contrairement au parcours C où elle attend le clic
    // "payer maintenant" sur l'email de demande de paiement).
    let paymentRequest
    try {
      paymentRequest = await createPaymentRequest({
        orgId,
        serviceId: registration.serviceId,
        sourceReference: registration.paymentReference!,
        amountCents: registration.priceCentsAtRegistration,
        // OBJET générique, jamais le titre de l'évènement : l'OBJET PayFiP
        // peut finir sur le relevé bancaire du payeur (visible par
        // d'autres que lui) et surtout, non borné, un titre trop long fait
        // échouer PayFiP ("erreur fonctionnelle O1 : la valeur de l'OBJET
        // est incorrecte") — même principe que svc-factures/svc-billetterie,
        // qui envoient déjà un libellé court et fixe.
        objectLabel: 'Inscription',
        payerEmail: registration.email,
        frontRedirectUrl: input.frontRedirectUrl,
      })
    } catch (error) {
      registration.status = 'cancelled'
      registration.cancelledAt = DateTime.now()
      await registration.save()
      await promoteNextWaitlisted(event.id)

      if (error instanceof SvcGestionError && error.status < 500) {
        return ctx.response.status(error.status).send(error.body)
      }
      throw error
    }

    registration.paymentRequestId = paymentRequest.id
    registration.payfipIdOp = paymentRequest.payfipIdOp
    await registration.save()

    return ctx.response.status(201).send({
      data: {
        registrationId: registration.id,
        status: registration.status,
        accessToken: registration.accessToken,
        paymentUrl: paymentRequest.paymentUrl,
        payfipIdOp: paymentRequest.payfipIdOp,
      },
    })
  }

  private async storeDocuments(
    registrationId: number,
    documents: Array<{ key: string; filename: string; mimeType: string; data: Buffer }>,
    trx: TransactionClientContract
  ) {
    for (const doc of documents) {
      await RegistrationDocument.create(
        {
          registrationId,
          documentKey: doc.key,
          filename: doc.filename,
          mimeType: doc.mimeType,
          fileData: doc.data,
          sizeBytes: doc.data.byteLength,
          isCurrent: true,
        },
        { client: trx }
      )
    }
  }

  /**
   * GET /registrations/by-token/:accessToken — statut courant + toutes
   * les données d'affichage des écrans d'état E1-E6.
   */
  async showByToken(ctx: HttpContext) {
    const found = await findRegistrationByAccessToken(ctx.internalAuth.orgId, ctx.params.accessToken)
    if (!found) return ctx.response.status(404).send({ error: 'registration_not_found' })

    return ctx.response.send({ data: serializeRegistrationForCitizen(found.registration, found.event) })
  }

  /**
   * POST /registrations/by-token/:accessToken/documents — re-dépôt après
   * rejet (parcours C, maquette) : uniquement si `status='rejected'` et
   * avant `documentDeadlineAt`. Les anciens documents sont marqués
   * `isCurrent=false` (historique conservé), pas supprimés. Repasse en
   * `awaiting_review` sans reformulaire.
   */
  async replaceDocuments(ctx: HttpContext) {
    const found = await findRegistrationByAccessToken(ctx.internalAuth.orgId, ctx.params.accessToken)
    if (!found) return ctx.response.status(404).send({ error: 'registration_not_found' })
    const { registration, event } = found

    if (registration.status !== 'rejected') {
      return ctx.response.status(409).send({ error: 'registration_not_rejected' })
    }
    if (registration.documentDeadlineAt && registration.documentDeadlineAt < DateTime.now()) {
      return ctx.response.status(422).send({ error: 'document_deadline_passed' })
    }

    const requirements = event.documentRequirements ?? []
    // Vrai rejet : toutes les exigences doivent être redéposées (les
    // anciens documents seront invalidés). Complément demandé
    // (keepExistingDocuments) : au moins une pièce suffit, les autres
    // restent telles que déposées initialement.
    const result = await this.readNamedDocuments(ctx, requirements, {
      requireAll: !registration.keepExistingDocuments,
    })
    if (!result.ok) return ctx.response.status(result.status).send(result.body)
    const processedFiles = result.documents

    await db.transaction(async (trx) => {
      if (!registration.keepExistingDocuments) {
        // Vrai rejet : tout l'ancien jeu de documents est invalidé, le
        // citoyen redépose tout.
        await RegistrationDocument.query({ client: trx })
          .where('registrationId', registration.id)
          .update({ isCurrent: false })
      } else {
        // Complément demandé : seules les exigences effectivement
        // redéposées ici remplacent leur version courante — les autres
        // pièces déjà déposées restent `isCurrent` inchangées.
        for (const doc of processedFiles) {
          await RegistrationDocument.query({ client: trx })
            .where('registrationId', registration.id)
            .where('documentKey', doc.key)
            .update({ isCurrent: false })
        }
      }

      await this.storeDocuments(registration.id, processedFiles, trx)

      await registration.useTransaction(trx).merge({
        status: 'awaiting_review',
        rejectionReason: null,
        documentDeadlineAt: null,
        keepExistingDocuments: false,
      }).save()
    })

    await notifyAgentsOfPendingReview(registration, event)

    return ctx.response.send({ data: { status: registration.status } })
  }

  /**
   * POST /registrations/by-token/:accessToken/cancel — auto-annulation
   * citoyenne, couvre aussi "quitter la liste d'attente". Interdite après
   * `registrationDeadline`.
   */
  async cancelByToken(ctx: HttpContext) {
    const found = await findRegistrationByAccessToken(ctx.internalAuth.orgId, ctx.params.accessToken)
    if (!found) return ctx.response.status(404).send({ error: 'registration_not_found' })
    const { registration, event } = found

    if (['cancelled', 'expired'].includes(registration.status)) {
      return ctx.response.status(409).send({ error: 'registration_already_terminal' })
    }
    if (event.registrationDeadline && event.registrationDeadline < DateTime.now()) {
      return ctx.response.status(422).send({ error: 'registration_deadline_passed' })
    }

    registration.status = 'cancelled'
    registration.cancelledAt = DateTime.now()
    await registration.save()

    await promoteNextWaitlisted(event.id)

    return ctx.response.send({ data: { status: registration.status } })
  }

  /**
   * POST /registrations/by-token/:accessToken/pay — 1re création de
   * session PayFiP (parcours B/C), OU confirmation d'une offre de liste
   * d'attente active (parcours D, maquette) : faute d'un endpoint dédié
   * dans le plan, cette même route sert de point d'action unique pour "je
   * veux cette place maintenant", qu'elle soit gratuite ou payante.
   */
  async payByToken(ctx: HttpContext) {
    const found = await findRegistrationByAccessToken(ctx.internalAuth.orgId, ctx.params.accessToken)
    if (!found) return ctx.response.status(404).send({ error: 'registration_not_found' })
    const { registration, event } = found

    const payload = await ctx.request.validateUsing(payRegistrationValidator)

    const hasActiveWaitlistOffer =
      registration.status === 'waitlisted' &&
      registration.waitlistNotifiedAt !== null &&
      (registration.waitlistResponseDeadline === null || registration.waitlistResponseDeadline > DateTime.now())

    if (hasActiveWaitlistOffer) {
      // Confirmation de l'offre : on sort de la liste d'attente vers le
      // parcours normal — justificatifs si l'évènement en exige, sinon
      // statut final direct (gratuit) ou awaiting_payment (payant),
      // formulaire déjà fourni à l'inscription initiale (voir plan §3 D).
      registration.waitlistPosition = null
      registration.waitlistNotifiedAt = null
      registration.waitlistResponseDeadline = null

      if (eventRequiresDocuments(event)) {
        registration.status = 'awaiting_review'
        await registration.save()
        await notifyAgentsOfPendingReview(registration, event)
        return ctx.response.send({ data: { status: registration.status } })
      }

      if (registration.priceCentsAtRegistration === 0) {
        registration.status = 'confirmed'
        await registration.save()
        await sendRegistrationConfirmationEmail(registration, event)
        return ctx.response.send({ data: { status: registration.status } })
      }

      registration.paymentReference ??= `INSC${String(registration.id).padStart(8, '0')}`
      await registration.save()
      // Tombe dans la branche paiement ci-dessous.
    } else if (registration.status !== 'awaiting_payment') {
      return ctx.response.status(409).send({ error: 'registration_not_payable', status: registration.status })
    }

    let paymentRequest
    try {
      paymentRequest = await createPaymentRequest({
        orgId: ctx.internalAuth.orgId,
        serviceId: registration.serviceId,
        sourceReference: registration.paymentReference!,
        amountCents: registration.priceCentsAtRegistration,
        // OBJET générique, jamais le titre de l'évènement : l'OBJET PayFiP
        // peut finir sur le relevé bancaire du payeur (visible par
        // d'autres que lui) et surtout, non borné, un titre trop long fait
        // échouer PayFiP ("erreur fonctionnelle O1 : la valeur de l'OBJET
        // est incorrecte") — même principe que svc-factures/svc-billetterie,
        // qui envoient déjà un libellé court et fixe.
        objectLabel: 'Inscription',
        payerEmail: registration.email,
        frontRedirectUrl: payload.frontRedirectUrl,
      })
    } catch (error) {
      if (error instanceof SvcGestionError && error.status < 500) {
        return ctx.response.status(error.status).send(error.body)
      }
      throw error
    }

    registration.status = 'awaiting_payment'
    registration.paymentRequestId = paymentRequest.id
    registration.payfipIdOp = paymentRequest.payfipIdOp
    await registration.save()

    return ctx.response.send({
      data: {
        status: registration.status,
        paymentUrl: paymentRequest.paymentUrl,
        payfipIdOp: paymentRequest.payfipIdOp,
      },
    })
  }

  /**
   * POST /registrations/by-token/:accessToken/retry-payment — nouvel
   * essai après un paiement refusé/annulé, tant que la place n'a pas été
   * reprise par quelqu'un d'autre (registration encore `cancelled`, pas
   * redevenue `waitlisted`/réattribuée).
   */
  async retryPayment(ctx: HttpContext) {
    const found = await findRegistrationByAccessToken(ctx.internalAuth.orgId, ctx.params.accessToken)
    if (!found) return ctx.response.status(404).send({ error: 'registration_not_found' })
    const { registration } = found

    if (registration.status !== 'cancelled' || !registration.payfipIdOp) {
      return ctx.response
        .status(409)
        .send({ error: 'registration_not_retryable', status: registration.status })
    }

    const payload = await ctx.request.validateUsing(retryRegistrationPaymentValidator)

    let paymentRequest
    try {
      paymentRequest = await retryPaymentRequest(registration.paymentRequestId!, {
        orgId: ctx.internalAuth.orgId,
        serviceId: registration.serviceId,
        sourceReference: registration.paymentReference!,
        amountCents: registration.priceCentsAtRegistration,
        // OBJET générique, jamais le titre de l'évènement : l'OBJET PayFiP
        // peut finir sur le relevé bancaire du payeur (visible par
        // d'autres que lui) et surtout, non borné, un titre trop long fait
        // échouer PayFiP ("erreur fonctionnelle O1 : la valeur de l'OBJET
        // est incorrecte") — même principe que svc-factures/svc-billetterie,
        // qui envoient déjà un libellé court et fixe.
        objectLabel: 'Inscription',
        payerEmail: registration.email,
        frontRedirectUrl: payload.frontRedirectUrl,
      })
    } catch (error) {
      if (error instanceof SvcGestionError && error.status < 500) {
        return ctx.response.status(error.status).send(error.body)
      }
      throw error
    }

    registration.paymentRequestId = paymentRequest.id
    registration.payfipIdOp = paymentRequest.payfipIdOp
    registration.status = 'awaiting_payment'
    registration.retryCount += 1
    await registration.save()

    return ctx.response.send({
      data: {
        status: registration.status,
        paymentUrl: paymentRequest.paymentUrl,
        payfipIdOp: paymentRequest.payfipIdOp,
      },
    })
  }

  /**
   * GET /registrations/by-token/:accessToken/attestation — PDF,
   * uniquement si `confirmed`.
   */
  async downloadAttestation(ctx: HttpContext) {
    const found = await findRegistrationByAccessToken(ctx.internalAuth.orgId, ctx.params.accessToken)
    if (!found) return ctx.response.status(404).send({ error: 'registration_not_found' })
    const { registration, event } = found

    if (registration.status !== 'confirmed') {
      return ctx.response.status(409).send({ error: 'registration_not_confirmed' })
    }

    const pdf = await generateRegistrationAttestationPdf(registration, event)

    ctx.response.header('Content-Type', 'application/pdf')
    ctx.response.header(
      'Content-Disposition',
      `attachment; filename="attestation-${registration.paymentReference ?? registration.id}.pdf"`
    )
    return ctx.response.send(pdf)
  }

  /**
   * POST /payment-webhooks — appelé par svc-gestion (pair à pair, hors
   * Gateway). Transition idempotente via UPDATE...WHERE conditionnel dans
   * une transaction — jamais un simple read-then-write (même garde que
   * paymentWebhook côté svc-billetterie).
   */
  async paymentWebhook(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(paymentWebhookValidator)

    const registration = await Registration.findBy('paymentReference', payload.sourceReference)
    if (!registration) {
      return ctx.response.status(404).send({ error: 'registration_not_found' })
    }

    if (registration.status !== 'awaiting_payment') {
      return ctx.response.send({ received: true, alreadyProcessed: true })
    }

    if (
      payload.amountCents !== registration.priceCentsAtRegistration ||
      payload.paymentRequestId !== registration.paymentRequestId
    ) {
      logger.warn(
        { registrationId: registration.id, payload },
        'paymentWebhook rejeté — montant ou paymentRequestId incohérent'
      )
      return ctx.response.status(422).send({ error: 'payment_webhook_mismatch' })
    }

    if (payload.status === 'paid') {
      const confirmed = await db.transaction(async (trx) => {
        const rows = await trx
          .from('registrations')
          .where('id', registration.id)
          .where('status', 'awaiting_payment')
          .update({ status: 'confirmed', updated_at: DateTime.now().toSQL() }, ['*'])

        return rows.length > 0
      })

      if (confirmed) {
        registration.status = 'confirmed'
        const event = await Event.find(registration.eventId)
        if (event) await sendRegistrationConfirmationEmail(registration, event)
      }
    } else {
      const rows = await db
        .from('registrations')
        .where('id', registration.id)
        .where('status', 'awaiting_payment')
        .update({ status: 'cancelled', updated_at: DateTime.now().toSQL() }, ['id'])

      if (rows.length > 0) {
        await promoteNextWaitlisted(registration.eventId)
      }
    }

    return ctx.response.send({ received: true })
  }

  /**
   * GET /events/:id/registrations — résumé des inscrits pour un
   * évènement (statut, contact, état de la revue documentaire).
   */
  async index(ctx: HttpContext) {
    const { orgId, role, servicePermissions } = ctx.internalAuth
    const { status, q, page, perPage } = await ctx.request.validateUsing(listRegistrationsValidator)

    const event = await Event.query().where('id', Number(ctx.params.id)).where('orgId', orgId).first()
    if (!event) return ctx.response.status(404).send({ error: 'event_not_found' })

    if (role !== 'admin' && !servicePermissions?.[String(event.serviceId)]?.canViewHistory) {
      return ctx.response.status(403).send({ error: 'permission_required' })
    }

    const query = Registration.query()
      .where('eventId', event.id)
      .preload('documents')
      .orderBy('createdAt', 'desc')

    if (status) query.where('status', status)
    if (q) {
      query.where((sub) => {
        sub
          .whereILike('email', `%${q}%`)
          .orWhereILike('firstName', `%${q}%`)
          .orWhereILike('lastName', `%${q}%`)
          .orWhereILike('paymentReference', `%${q}%`)
      })
    }

    const registrations = await query.paginate(page ?? 1, perPage ?? 25)

    return ctx.response.send({
      data: registrations.all().map(serializeRegistrationForAgent),
      meta: registrations.getMeta(),
    })
  }

  /**
   * POST /registrations/:id/review — décision de l'agent sur les
   * justificatifs déposés (parcours C).
   */
  async review(ctx: HttpContext) {
    const { orgId, role, servicePermissions, serviceIds } = ctx.internalAuth

    const registration = await Registration.query()
      .where('id', Number(ctx.params.id))
      .where('orgId', orgId)
      .first()
    if (!registration) return ctx.response.status(404).send({ error: 'registration_not_found' })

    if (!serviceIds?.includes(registration.serviceId)) {
      return ctx.response.status(403).send({ error: 'service_not_allowed_for_agent' })
    }
    if (role !== 'admin' && !servicePermissions?.[String(registration.serviceId)]?.canScan) {
      return ctx.response.status(403).send({ error: 'permission_required' })
    }

    const payload = await ctx.request.validateUsing(reviewRegistrationValidator)

    // 'revert' : annule une décision prise par erreur. Autorisé uniquement
    // depuis 'awaiting_payment' (aucune session PayFiP ouverte tant que le
    // citoyen n'a pas cliqué payer, voir payByToken) ou depuis 'confirmed'
    // pour un évènement gratuit (rien n'a jamais été encaissé) — jamais
    // depuis 'confirmed' en payant, où un vrai paiement a déjà été capturé
    // et nécessiterait un remboursement manuel hors périmètre.
    if (payload.decision === 'revert') {
      const revertAllowed =
        registration.status === 'awaiting_payment' ||
        (registration.status === 'confirmed' && registration.paymentMethod === 'free')
      if (!revertAllowed) {
        return ctx.response.status(409).send({ error: 'revert_not_allowed' })
      }

      registration.status = 'awaiting_review'
      registration.reviewedBy = null
      registration.reviewedByLabel = null
      registration.reviewedAt = null
      await registration.save()

      return ctx.response.send({ data: serializeRegistrationForAgent(registration) })
    }

    if (registration.status !== 'awaiting_review') {
      return ctx.response.status(409).send({ error: 'registration_not_awaiting_review' })
    }

    const event = await Event.find(registration.eventId)
    if (!event) return ctx.response.status(404).send({ error: 'event_not_found' })

    registration.reviewedBy = ctx.internalAuth.sub ? Number(ctx.internalAuth.sub) : null
    registration.reviewedByLabel = agentLabel(ctx.internalAuth)
    registration.reviewedAt = DateTime.now()

    if (payload.decision === 'reject' || payload.decision === 'request_more_documents') {
      registration.status = 'rejected'
      registration.rejectionReason = payload.rejectionReason ?? null
      registration.documentDeadlineAt = DateTime.now().plus({ days: DOCUMENT_RESUBMIT_DEADLINE_DAYS })
      // 'request_more_documents' : les documents déjà déposés restent
      // valables (voir replaceDocuments, qui ne les invalide plus dans ce
      // cas) — seul un vrai 'reject' force à tout redéposer.
      registration.keepExistingDocuments = payload.decision === 'request_more_documents'
      await registration.save()

      await sendRegistrationRejectionEmail(registration, event)
      return ctx.response.send({ data: serializeRegistrationForAgent(registration) })
    }

    // Approbation : gratuit → confirmé direct ; payant → awaiting_payment,
    // aucune session PayFiP créée tout de suite (l'email de demande de
    // paiement pointe vers /pay, voir plan §0 décisions de conception).
    if (registration.priceCentsAtRegistration === 0) {
      registration.status = 'confirmed'
      await registration.save()
      await sendRegistrationConfirmationEmail(registration, event)
    } else {
      registration.status = 'awaiting_payment'
      registration.paymentReference ??= `INSC${String(registration.id).padStart(8, '0')}`
      await registration.save()
      await sendPaymentRequestEmail(registration, event)
    }

    return ctx.response.send({ data: serializeRegistrationForAgent(registration) })
  }

  /**
   * POST /registrations/:id/resend-reminder — l'agent renvoie manuellement
   * l'email déjà attendu par le citoyen (demande de paiement ou redépôt de
   * justificatif) quand ça traîne — pas une nouvelle décision, juste un
   * rappel du même contenu.
   */
  async resendReminder(ctx: HttpContext) {
    const { orgId, role, servicePermissions, serviceIds } = ctx.internalAuth

    const registration = await Registration.query()
      .where('id', Number(ctx.params.id))
      .where('orgId', orgId)
      .first()
    if (!registration) return ctx.response.status(404).send({ error: 'registration_not_found' })

    if (!serviceIds?.includes(registration.serviceId)) {
      return ctx.response.status(403).send({ error: 'service_not_allowed_for_agent' })
    }
    if (role !== 'admin' && !servicePermissions?.[String(registration.serviceId)]?.canScan) {
      return ctx.response.status(403).send({ error: 'permission_required' })
    }

    if (registration.status !== 'awaiting_payment' && registration.status !== 'rejected') {
      return ctx.response.status(409).send({ error: 'nothing_to_resend' })
    }

    if (registration.lastReminderSentAt) {
      const minutesSinceLast = DateTime.now().diff(registration.lastReminderSentAt, 'minutes').minutes
      if (minutesSinceLast < REMINDER_COOLDOWN_MINUTES) {
        return ctx.response.status(429).send({
          error: 'reminder_cooldown',
          retryAfterMinutes: Math.ceil(REMINDER_COOLDOWN_MINUTES - minutesSinceLast),
        })
      }
    }

    const event = await Event.find(registration.eventId)
    if (!event) return ctx.response.status(404).send({ error: 'event_not_found' })

    if (registration.status === 'awaiting_payment') {
      await sendPaymentRequestEmail(registration, event)
    } else {
      await sendRegistrationRejectionEmail(registration, event)
    }

    registration.lastReminderSentAt = DateTime.now()
    await registration.save()

    return ctx.response.send({ data: serializeRegistrationForAgent(registration) })
  }

  /**
   * GET /registrations/:id/documents/:documentId — stream du blob,
   * réservé à canScan ou canViewHistory sur le service de l'inscription.
   */
  async downloadDocument(ctx: HttpContext) {
    const { orgId, role, servicePermissions, serviceIds } = ctx.internalAuth

    const registration = await Registration.query()
      .where('id', Number(ctx.params.id))
      .where('orgId', orgId)
      .first()
    if (!registration) return ctx.response.status(404).send({ error: 'registration_not_found' })

    if (!serviceIds?.includes(registration.serviceId)) {
      return ctx.response.status(403).send({ error: 'service_not_allowed_for_agent' })
    }
    const permissions = servicePermissions?.[String(registration.serviceId)]
    if (role !== 'admin' && !permissions?.canScan && !permissions?.canViewHistory) {
      return ctx.response.status(403).send({ error: 'permission_required' })
    }

    const document = await RegistrationDocument.query()
      .where('id', Number(ctx.params.documentId))
      .where('registrationId', registration.id)
      .first()
    if (!document) return ctx.response.status(404).send({ error: 'document_not_found' })

    // document.filename vient de file.clientName, fourni par le citoyen à
    // l'upload — jamais injecté tel quel dans un paramètre de header quoté.
    const safeFilename = document.filename.replace(/["\\]/g, '_').replace(/[\r\n]/g, '')
    ctx.response.header('Content-Type', document.mimeType)
    ctx.response.header('Content-Disposition', `inline; filename="${safeFilename}"`)
    return ctx.response.send(document.fileData)
  }
}
