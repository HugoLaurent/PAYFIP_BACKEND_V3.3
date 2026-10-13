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
    // Copies (CC) — uniquement pour un envoi `ephemeral` : non persistées,
    // donc jamais rejouées par une relance.
    cc: vine.array(vine.string().trim().email()).maxLength(5).optional(),
    // Envoi éphémère : les pièces jointes ne sont JAMAIS écrites en base
    // (email_deliveries.attachments reste null) et un échec n'est pas
    // rejoué — l'appelant reçoit un 502 et décide quoi faire. Prévu pour les
    // pièces justificatives des citoyens (voir svc-inscription).
    ephemeral: vine.boolean().optional(),
  })
)
