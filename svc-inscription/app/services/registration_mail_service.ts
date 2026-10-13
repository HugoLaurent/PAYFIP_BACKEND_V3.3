import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import type Registration from '#models/registration'
import type Event from '#models/event'
import { sendMail } from '#services/svc_mail_client'
import { fetchServiceStatus } from '#services/svc_auth_client'
import FailedRegistrationMail from '#models/failed_registration_mail'
import ServiceSettings from '#models/service_settings'
import type { FailedRegistrationMailKind } from '#models/failed_registration_mail'
import { notifyOpsAlert } from '#services/ops_alert_service'

// Au-delà de ce délai depuis la première tentative, on arrête de rejouer et
// on alerte plutôt que d'échouer indéfiniment en silence — même logique
// que ticket_confirmation_mail_service.ts côté svc-billetterie.
const MAX_RETRY_AGE_HOURS = 24

interface ServiceIdentity {
  name?: string
  orgName?: string
  logoUrl?: string
  slug?: string
}

// Dégrade vers un en-tête générique si svc-auth ne répond pas — jamais une
// erreur d'envoi pour un habillage visuel. `slug` peut manquer (service
// sans slug public) : voir buildFrontUrl, qui gère ce cas en dégradant le
// lien plutôt que de faire échouer l'envoi.
async function loadServiceIdentity(orgId: number, serviceId: number): Promise<ServiceIdentity> {
  const status = await fetchServiceStatus(orgId, serviceId).catch(() => null)
  return {
    name: status?.name,
    orgName: status?.orgName ?? undefined,
    logoUrl: status?.hasLogo
      ? `${env.get('PAYFIP_PUBLIC_BASE_URL')}/services/${serviceId}/logo`
      : undefined,
    slug: status?.slug ?? undefined,
  }
}

/**
 * Lien front citoyen (page InscriptionReturnPage, voir payfip-front) —
 * jamais une URL PayFiP brute (voir commentaire du gabarit
 * inscription_payment_request_mail_template.ts côté svc-mail). Si le slug
 * du service est introuvable (dégradation svc-auth), retombe sur l'id
 * numérique du service en tant que segment — la route front n'en a
 * techniquement pas besoin pour résoudre l'inscription (l'accessToken
 * suffit), seulement pour l'affichage de l'en-tête du service.
 */
function buildFrontUrl(
  slug: string | undefined,
  serviceId: number,
  accessToken: string,
  orgId: number
): string {
  const segment = slug ?? String(serviceId)
  // orgId est requis par InscriptionReturnPage (missingParams) même en
  // mode instantané — voir payfip-front/src/pages/public/InscriptionReturnPage.tsx.
  return `${env.get('FRONT_PUBLIC_BASE_URL')}/inscription/${segment}/retour?accessToken=${accessToken}&orgId=${orgId}`
}

/**
 * Point commun aux 4 emails du parcours inscription : envoi best-effort,
 * puis ticket de retry (ledger `failed_registration_mails`, une ligne par
 * inscription) en cas d'échec, abandon + alerte ops après 24h. Même
 * logique que ticket_confirmation_mail_service.ts, généralisée aux 4
 * `mailKind` puisqu'une seule relance email est pertinente à la fois pour
 * une inscription donnée.
 */
async function sendWithRetryLedger(
  registration: Registration,
  mailKind: FailedRegistrationMailKind,
  send: () => Promise<unknown>
): Promise<void> {
  try {
    await send()

    // Un succès après un ou plusieurs échecs : plus rien à rejouer.
    await FailedRegistrationMail.query().where('registrationId', registration.id).delete()
  } catch (error) {
    logger.warn(
      { registrationId: registration.id, mailKind, error },
      `registration_mail_service: échec d'envoi (${mailKind})`
    )

    const existing = await FailedRegistrationMail.findBy('registrationId', registration.id)
    const attempts = (existing?.attempts ?? 0) + 1
    const firstFailedAt = existing?.createdAt ?? DateTime.now()
    const ageHours = DateTime.now().diff(firstFailedAt, 'hours').hours

    if (ageHours >= MAX_RETRY_AGE_HOURS) {
      await FailedRegistrationMail.query().where('registrationId', registration.id).delete()
      await notifyOpsAlert(
        `Email d'inscription abandonné après 24h (${mailKind})`,
        `Inscription #${registration.id} (${registration.email}) : ${attempts} tentative(s) échouée(s) sur ${MAX_RETRY_AGE_HOURS}h, abandon.`
      )
    } else {
      await FailedRegistrationMail.updateOrCreate(
        { registrationId: registration.id },
        { mailKind, attempts, nextRetryAt: DateTime.now().plus({ minutes: 2 ** attempts }) }
      )
    }
  }
}

export async function sendRegistrationConfirmationEmail(
  registration: Registration,
  event: Event
): Promise<void> {
  const identity = await loadServiceIdentity(registration.orgId, registration.serviceId)

  await sendWithRetryLedger(registration, 'confirmation', () =>
    sendMail({
      template: 'inscription_confirmation',
      to: registration.email,
      serviceId: String(registration.serviceId),
      data: {
        email: registration.email,
        eventTitle: event.title,
        eventDate: event.eventDate?.toFormat('dd/MM/yyyy'),
        eventLocation: event.location ?? undefined,
        quantity: registration.quantity,
        amountCents: registration.priceCentsAtRegistration,
        registrationNumber: registration.paymentReference ?? String(registration.id),
        manageUrl: buildFrontUrl(identity.slug, registration.serviceId, registration.accessToken!, registration.orgId),
        serviceName: identity.name,
        orgName: identity.orgName,
        logoUrl: identity.logoUrl,
      },
    })
  )
}

export async function sendPaymentRequestEmail(registration: Registration, event: Event): Promise<void> {
  const identity = await loadServiceIdentity(registration.orgId, registration.serviceId)

  await sendWithRetryLedger(registration, 'payment_request', () =>
    sendMail({
      template: 'inscription_payment_request',
      to: registration.email,
      serviceId: String(registration.serviceId),
      data: {
        email: registration.email,
        eventTitle: event.title,
        amountCents: registration.priceCentsAtRegistration,
        payUrl: buildFrontUrl(identity.slug, registration.serviceId, registration.accessToken!, registration.orgId),
        serviceName: identity.name,
        orgName: identity.orgName,
        logoUrl: identity.logoUrl,
      },
    })
  )
}

export async function sendRegistrationRejectionEmail(
  registration: Registration,
  event: Event
): Promise<void> {
  const identity = await loadServiceIdentity(registration.orgId, registration.serviceId)

  await sendWithRetryLedger(registration, 'rejection', () =>
    sendMail({
      template: 'inscription_registration_rejected',
      to: registration.email,
      serviceId: String(registration.serviceId),
      data: {
        email: registration.email,
        eventTitle: event.title,
        rejectionReason: registration.rejectionReason,
        documentDeadlineAt: registration.documentDeadlineAt?.toFormat('dd/MM/yyyy'),
        redepositUrl: buildFrontUrl(identity.slug, registration.serviceId, registration.accessToken!, registration.orgId),
        serviceName: identity.name,
        orgName: identity.orgName,
        logoUrl: identity.logoUrl,
      },
    })
  )
}

export class DocumentsRelayError extends Error {}

/**
 * Boîte de l'agent qui reçoit les pièces (et ses copies), réglée une fois
 * pour tout le service dans Paramètres. À appeler dans une portée
 * runOnTenant(). Jamais exposée côté citoyen.
 */
export async function loadDocumentsDestination(): Promise<{ email: string | null; cc: string[] }> {
  const settings = await ServiceSettings.first()
  return { email: settings?.documentContactEmail ?? null, cc: settings?.documentContactCc ?? [] }
}

export interface DocumentToRelay {
  key: string
  filename: string
  mimeType: string
  data: Buffer
}

/**
 * Relaie les pièces justificatives du citoyen par email à l'agent (adresse de
 * réception de l'évènement, copies comprises), depuis le domaine du service
 * via svc-mail. AUCUNE pièce n'est stockée : envoi éphémère (svc-mail n'écrit
 * pas les pièces jointes en base et ne rejoue pas un échec). Volontairement
 * SANS ticket de retry, contrairement aux autres emails : si l'envoi échoue,
 * on lève DocumentsRelayError et l'appelant annule l'inscription — le citoyen
 * redépose, plutôt qu'une inscription sans que l'agent ait jamais reçu ses
 * pièces.
 */
export async function sendDocumentsToAgentEmail(
  registration: Registration,
  event: Event,
  documents: DocumentToRelay[],
  options: { resend: boolean }
): Promise<void> {
  const destination = await loadDocumentsDestination()
  if (!destination.email) {
    logger.error(
      { registrationId: registration.id, serviceId: registration.serviceId },
      "registration_mail_service: relais des pièces impossible — le service n'a pas d'adresse de réception (à renseigner dans Services > Paramètres)"
    )
    throw new DocumentsRelayError('Aucune adresse de réception des pièces pour ce service')
  }

  const labelByKey = new Map((event.documentRequirements ?? []).map((r) => [r.key, r.label]))

  try {
    const identity = await loadServiceIdentity(registration.orgId, registration.serviceId)

    await sendMail({
      template: 'inscription_documents_received',
      to: destination.email,
      cc: destination.cc,
      ephemeral: true,
      serviceId: String(registration.serviceId),
      attachments: documents.map((doc) => ({
        // "Pièce d'identité - scan.pdf" : le libellé de l'exigence d'abord,
        // pour que l'agent sache à quelle pièce chaque fichier répond.
        filename: `${labelByKey.get(doc.key) ?? doc.key} - ${doc.filename}`.replace(/[\\/:*?"<>|]/g, '_'),
        contentBase64: doc.data.toString('base64'),
        contentType: doc.mimeType,
      })),
      data: {
        eventTitle: event.title,
        participantName: `${registration.firstName} ${registration.lastName}`,
        participantEmail: registration.email,
        registrationReference: registration.paymentReference ?? String(registration.id),
        documents: (event.documentRequirements ?? []).map((requirement) => requirement.label),
        resend: options.resend,
        serviceName: identity.name,
        orgName: identity.orgName,
        logoUrl: identity.logoUrl,
      },
    })
  } catch (error) {
    // `err` (et non `error`) : c'est la clé que le logger sérialise avec le
    // message — sinon l'erreur apparaît comme un objet vide dans les logs.
    logger.error(
      { registrationId: registration.id, eventId: event.id, err: error },
      'registration_mail_service: échec du relais des pièces justificatives par email'
    )
    throw new DocumentsRelayError('Échec du relais des pièces par email')
  }
}

/**
 * Envoyée depuis EventsController#cancel à chaque inscription encore
 * active au moment de l'annulation. `wasPaid` distingue le cas d'un
 * paiement PayFiP déjà encaissé (registration.status était `confirmed`
 * avant l'annulation, avec un montant non nul) — aucun remboursement
 * automatique n'est déclenché ici, l'email invite simplement le citoyen à
 * contacter l'organisme.
 */
export async function sendEventCancelledEmail(
  registration: Registration,
  event: Event,
  wasPaid: boolean
): Promise<void> {
  const identity = await loadServiceIdentity(registration.orgId, registration.serviceId)

  await sendWithRetryLedger(registration, 'event_cancelled', () =>
    sendMail({
      template: 'inscription_event_cancelled',
      to: registration.email,
      serviceId: String(registration.serviceId),
      data: {
        email: registration.email,
        eventTitle: event.title,
        eventDate: event.eventDate?.toFormat('dd/MM/yyyy'),
        wasPaid,
        amountCents: registration.priceCentsAtRegistration,
        serviceName: identity.name,
        orgName: identity.orgName,
        logoUrl: identity.logoUrl,
      },
    })
  )
}

export async function sendWaitlistOfferEmail(registration: Registration, event: Event): Promise<void> {
  const identity = await loadServiceIdentity(registration.orgId, registration.serviceId)

  await sendWithRetryLedger(registration, 'waitlist_offer', () =>
    sendMail({
      template: 'inscription_waitlist_offer',
      to: registration.email,
      serviceId: String(registration.serviceId),
      data: {
        email: registration.email,
        eventTitle: event.title,
        waitlistResponseDeadline: registration.waitlistResponseDeadline?.toFormat('dd/MM/yyyy HH:mm'),
        confirmUrl: buildFrontUrl(identity.slug, registration.serviceId, registration.accessToken!, registration.orgId),
        serviceName: identity.name,
        orgName: identity.orgName,
        logoUrl: identity.logoUrl,
      },
    })
  )
}

