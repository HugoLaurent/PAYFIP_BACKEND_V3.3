import vine from '@vinejs/vine'
import { renderOtpCodeEmail } from '#services/otp_code_mail_template'
import { renderTicketConfirmationEmail } from '#services/ticket_confirmation_mail_template'
import { renderInvoiceConfirmationEmail } from '#services/invoice_confirmation_mail_template'
import { renderInscriptionConfirmationEmail } from '#services/inscription_confirmation_mail_template'
import { renderInscriptionPaymentRequestEmail } from '#services/inscription_payment_request_mail_template'
import { renderInscriptionRegistrationRejectedEmail } from '#services/inscription_registration_rejected_mail_template'
import { renderInscriptionWaitlistOfferEmail } from '#services/inscription_waitlist_offer_mail_template'
import { renderInscriptionEventCancelledEmail } from '#services/inscription_event_cancelled_mail_template'
import { renderInscriptionAgentReviewNeededEmail } from '#services/inscription_agent_review_needed_mail_template'

export const MAIL_TEMPLATE_NAMES = [
  'otp_code',
  'ticket_confirmation',
  'invoice_confirmation',
  'inscription_confirmation',
  'inscription_payment_request',
  'inscription_registration_rejected',
  'inscription_waitlist_offer',
  'inscription_event_cancelled',
  'inscription_agent_review_needed',
] as const
export type MailTemplateName = (typeof MAIL_TEMPLATE_NAMES)[number]

const otpCodeValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(1),
    ttlMinutes: vine.number().positive(),
  })
)

const ticketConfirmationValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email(),
    confirmation: vine.string().trim().minLength(1),
    visitDate: vine.string().trim().minLength(1),
    billetsSummary: vine.string().trim().minLength(1),
    // .min(0) et pas .positive() : un tarif à 0€ est un cas normal côté
    // billetterie (voir tariff.ts), la confirmation gratuite doit pouvoir
    // s'envoyer comme n'importe quelle autre.
    totalAmountCents: vine.number().min(0),
    // Identité du service émetteur — absente seulement si svc-auth était
    // injoignable au moment de l'envoi, l'email dégrade alors vers un
    // en-tête générique plutôt que d'échouer.
    serviceName: vine.string().trim().optional(),
    orgName: vine.string().trim().optional(),
    logoUrl: vine.string().trim().url({ require_tld: false }).optional(),
  })
)

const invoiceConfirmationValidator = vine.compile(
  vine.object({
    confirmation: vine.string().trim().minLength(1),
    objectLabel: vine.string().trim().minLength(1),
    amountCents: vine.number().positive(),
    clientNumber: vine.string().trim().optional(),
    serviceName: vine.string().trim().optional(),
    orgName: vine.string().trim().optional(),
    logoUrl: vine.string().trim().url({ require_tld: false }).optional(),
  })
)

const inscriptionConfirmationValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email(),
    eventTitle: vine.string().trim().minLength(1),
    eventDate: vine.string().trim().optional(),
    eventLocation: vine.string().trim().optional(),
    quantity: vine.number().positive(),
    amountCents: vine.number().min(0),
    registrationNumber: vine.string().trim().minLength(1),
    serviceName: vine.string().trim().optional(),
    orgName: vine.string().trim().optional(),
    logoUrl: vine.string().trim().url({ require_tld: false }).optional(),
  })
)

const inscriptionPaymentRequestValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email(),
    eventTitle: vine.string().trim().minLength(1),
    amountCents: vine.number().positive(),
    // Lien front portant l'accessToken de l'inscription, pas une URL
    // PayFiP — on ne valide donc que la forme d'URL générique.
    payUrl: vine.string().trim().url(),
    serviceName: vine.string().trim().optional(),
    orgName: vine.string().trim().optional(),
    logoUrl: vine.string().trim().url({ require_tld: false }).optional(),
  })
)

const inscriptionRegistrationRejectedValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email(),
    eventTitle: vine.string().trim().minLength(1),
    rejectionReason: vine.string().trim().minLength(1),
    documentDeadlineAt: vine.string().trim().minLength(1),
    redepositUrl: vine.string().trim().url(),
    serviceName: vine.string().trim().optional(),
    orgName: vine.string().trim().optional(),
    logoUrl: vine.string().trim().url({ require_tld: false }).optional(),
  })
)

const inscriptionWaitlistOfferValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email(),
    eventTitle: vine.string().trim().minLength(1),
    waitlistResponseDeadline: vine.string().trim().minLength(1),
    confirmUrl: vine.string().trim().url(),
    serviceName: vine.string().trim().optional(),
    orgName: vine.string().trim().optional(),
    logoUrl: vine.string().trim().url({ require_tld: false }).optional(),
  })
)

const inscriptionEventCancelledValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email(),
    eventTitle: vine.string().trim().minLength(1),
    eventDate: vine.string().trim().optional(),
    wasPaid: vine.boolean(),
    amountCents: vine.number().min(0),
    serviceName: vine.string().trim().optional(),
    orgName: vine.string().trim().optional(),
    logoUrl: vine.string().trim().url({ require_tld: false }).optional(),
  })
)

const inscriptionAgentReviewNeededValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email(),
    eventTitle: vine.string().trim().minLength(1),
    registrantName: vine.string().trim().minLength(1),
    serviceName: vine.string().trim().optional(),
    orgName: vine.string().trim().optional(),
    logoUrl: vine.string().trim().url({ require_tld: false }).optional(),
  })
)

export interface RenderedEmail {
  subject: string
  html: string
}

export async function renderMailTemplate(
  template: MailTemplateName,
  data: unknown
): Promise<RenderedEmail> {
  switch (template) {
    case 'otp_code': {
      const parsed = await otpCodeValidator.validate(data)
      return { subject: 'Votre code de vérification', html: renderOtpCodeEmail(parsed) }
    }
    case 'ticket_confirmation': {
      const parsed = await ticketConfirmationValidator.validate(data)
      return { subject: 'Réservation confirmée', html: renderTicketConfirmationEmail(parsed) }
    }
    case 'invoice_confirmation': {
      const parsed = await invoiceConfirmationValidator.validate(data)
      return { subject: 'Paiement confirmé', html: renderInvoiceConfirmationEmail(parsed) }
    }
    case 'inscription_confirmation': {
      const parsed = await inscriptionConfirmationValidator.validate(data)
      return { subject: 'Inscription confirmée', html: renderInscriptionConfirmationEmail(parsed) }
    }
    case 'inscription_payment_request': {
      const parsed = await inscriptionPaymentRequestValidator.validate(data)
      return {
        subject: 'Votre inscription est validée, procédez au paiement',
        html: renderInscriptionPaymentRequestEmail(parsed),
      }
    }
    case 'inscription_registration_rejected': {
      const parsed = await inscriptionRegistrationRejectedValidator.validate(data)
      return {
        subject: 'Votre justificatif doit être complété',
        html: renderInscriptionRegistrationRejectedEmail(parsed),
      }
    }
    case 'inscription_waitlist_offer': {
      const parsed = await inscriptionWaitlistOfferValidator.validate(data)
      return {
        subject: "Une place s'est libérée",
        html: renderInscriptionWaitlistOfferEmail(parsed),
      }
    }
    case 'inscription_event_cancelled': {
      const parsed = await inscriptionEventCancelledValidator.validate(data)
      return {
        subject: 'Évènement annulé',
        html: renderInscriptionEventCancelledEmail(parsed),
      }
    }
    case 'inscription_agent_review_needed': {
      const parsed = await inscriptionAgentReviewNeededValidator.validate(data)
      return {
        subject: 'Nouvelle inscription à vérifier',
        html: renderInscriptionAgentReviewNeededEmail(parsed),
      }
    }
  }
}
