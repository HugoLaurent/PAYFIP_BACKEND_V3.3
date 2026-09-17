import vine from '@vinejs/vine'
import { MAIL_TEMPLATE_NAMES } from '#services/mail_template_registry'

export const sendEmailValidator = vine.compile(
  vine.object({
    template: vine.enum(MAIL_TEMPLATE_NAMES),
    to: vine.string().trim().email(),
    // Absent pour les emails sans service (OTP) — voir
    // aregie_mail_settings_service.ts#resolveApiKey.
    serviceId: vine.string().trim().optional(),
    data: vine.object({}).allowUnknownProperties(),
    attachments: vine
      .array(
        vine.object({
          filename: vine.string().trim().minLength(1),
          contentBase64: vine.string().trim().minLength(1),
          contentType: vine.string().trim().minLength(1),
        })
      )
      .optional(),
  })
)
