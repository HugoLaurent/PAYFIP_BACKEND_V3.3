import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import EmailDelivery from '#models/email_delivery'
import { renderMailTemplate, type MailTemplateName } from '#services/mail_template_registry'
import { notifyOpsAlert } from '#services/ops_alert_service'
import { resolveApiKey } from '#services/aregie_mail_settings_service'

// Au-delà de ce délai depuis la première tentative, on arrête de rejouer
// (le backoff exponentiel a de toute façon rendu les essais suivants
// extrêmement rares) et on alerte plutôt que d'échouer indéfiniment en
// silence.
const MAX_RETRY_AGE_HOURS = 24

const DEFAULT_AREGIE_MAIL_API_URL = 'https://mail.aregie.com/api/send'

interface AregieMailResponse {
  success: boolean
  error?: string
}

// L'expéditeur ("from") n'est plus paramétrable ici : il est déterminé côté
// AREGIE Mail par la boîte connectée à la clé API (voir CLIENT_GUIDE.md du
// dépôt AREGIE_MAIL) — MAIL_FROM_ADDRESS/MAIL_FROM_NAME n'ont plus d'usage.
//
// La clé API elle-même vit en base (chiffrée, voir
// aregie_mail_settings_service.ts), saisie par un admin depuis le back
// office — plus de Vault, plus de variable d'environnement pour ce secret.
// Une clé par service (si configurée) prime sur la clé par défaut.
async function sendViaAregieMail(params: {
  to: string
  subject: string
  html: string
  serviceId: string | null
  attachments: { filename: string; contentBase64: string; contentType: string }[]
}): Promise<void> {
  const apiKey = await resolveApiKey(params.serviceId)
  if (!apiKey) {
    throw new Error('Clé API AREGIE Mail non configurée (back office)')
  }

  const response = await fetch(env.get('AREGIE_MAIL_API_URL') ?? DEFAULT_AREGIE_MAIL_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      to: params.to,
      subject: params.subject,
      html: params.html,
      attachments: params.attachments.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.contentBase64,
        contentType: attachment.contentType,
      })),
    }),
  })

  const body = (await response.json().catch(() => null)) as AregieMailResponse | null

  if (!response.ok || !body?.success) {
    throw new Error(body?.error ?? `AREGIE Mail: HTTP ${response.status}`)
  }
}

export async function attemptDelivery(delivery: EmailDelivery): Promise<void> {
  delivery.attempts += 1

  try {
    const rendered = await renderMailTemplate(
      delivery.template as MailTemplateName,
      delivery.data
    )

    const recipient = env.get('MAIL_TEST_OVERRIDE_EMAIL') ?? delivery.toEmail
    if (recipient !== delivery.toEmail) {
      logger.warn(
        { to: delivery.toEmail, recipient },
        'emails: livraison redirigée (MAIL_TEST_OVERRIDE_EMAIL)'
      )
    }

    await sendViaAregieMail({
      to: recipient,
      subject: rendered.subject,
      html: rendered.html,
      serviceId: delivery.serviceId,
      attachments: delivery.attachments ?? [],
    })

    delivery.status = 'sent'
    delivery.sentAt = DateTime.now()
    delivery.error = null
    delivery.nextRetryAt = null
  } catch (error) {
    logger.warn({ deliveryId: delivery.id, template: delivery.template, error }, "emails: échec d'envoi")
    delivery.status = 'failed'
    delivery.error = error instanceof Error ? error.message : String(error)

    const ageHours = DateTime.now().diff(delivery.createdAt, 'hours').hours
    if (ageHours >= MAX_RETRY_AGE_HOURS) {
      // nextRetryAt=null exclut la ligne de retryFailedDeliveries() (qui
      // filtre nextRetryAt <= now) sans avoir besoin d'un statut dédié.
      delivery.nextRetryAt = null
      await notifyOpsAlert(
        'Email abandonné après 24h',
        `Template "${delivery.template}" vers ${delivery.toEmail} (delivery #${delivery.id}) : ${delivery.attempts} tentatives échouées sur ${MAX_RETRY_AGE_HOURS}h, abandon. Dernière erreur : ${delivery.error}`
      )
    } else {
      delivery.nextRetryAt = DateTime.now().plus({ minutes: 2 ** delivery.attempts })
    }
  }

  await delivery.save()
}

export async function retryFailedDeliveries(): Promise<number> {
  const deliveries = await EmailDelivery.query()
    .where('status', 'failed')
    .where('nextRetryAt', '<=', DateTime.now().toSQL())

  for (const delivery of deliveries) {
    await attemptDelivery(delivery)
  }

  return deliveries.length
}
