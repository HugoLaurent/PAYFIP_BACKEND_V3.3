import vine from '@vinejs/vine'
import { renderOtpCodeEmail } from '#services/otp_code_mail_template'
import { renderTicketConfirmationEmail } from '#services/ticket_confirmation_mail_template'
import { renderInvoiceConfirmationEmail } from '#services/invoice_confirmation_mail_template'

export const MAIL_TEMPLATE_NAMES = ['otp_code', 'ticket_confirmation', 'invoice_confirmation'] as const
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
    totalAmountCents: vine.number().positive(),
  })
)

const invoiceConfirmationValidator = vine.compile(
  vine.object({
    confirmation: vine.string().trim().minLength(1),
    objectLabel: vine.string().trim().minLength(1),
    amountCents: vine.number().positive(),
    clientNumber: vine.string().trim().optional(),
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
  }
}
