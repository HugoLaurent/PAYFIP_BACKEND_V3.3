import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import mail from '@adonisjs/mail/services/main'
import env from '#start/env'
import EmailDelivery from '#models/email_delivery'
import { renderMailTemplate, type MailTemplateName } from '#services/mail_template_registry'
import { notifyOpsAlert } from '#services/ops_alert_service'

// Au-delà de ce délai depuis la première tentative, on arrête de rejouer
// (le backoff exponentiel a de toute façon rendu les essais suivants
// extrêmement rares) et on alerte plutôt que d'échouer indéfiniment en
// silence.
const MAX_RETRY_AGE_HOURS = 24

export async function attemptDelivery(delivery: EmailDelivery): Promise<void> {
  delivery.attempts += 1

  try {
    const fromAddress = env.get('MAIL_FROM_ADDRESS')
    if (!fromAddress) {
      throw new Error('MAIL_FROM_ADDRESS manquant')
    }

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

    await mail.send((message) => {
      message
        .to(recipient)
        .from(fromAddress, env.get('MAIL_FROM_NAME'))
        .subject(rendered.subject)
        .html(rendered.html)

      for (const attachment of delivery.attachments ?? []) {
        message.attachData(Buffer.from(attachment.contentBase64, 'base64'), {
          filename: attachment.filename,
          contentType: attachment.contentType,
        })
      }
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
