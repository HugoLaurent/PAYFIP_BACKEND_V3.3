import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import mail from '@adonisjs/mail/services/main'
import env from '#start/env'
import EmailDelivery from '#models/email_delivery'
import { renderMailTemplate, type MailTemplateName } from '#services/mail_template_registry'

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
    delivery.nextRetryAt = DateTime.now().plus({ minutes: 2 ** delivery.attempts })
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
