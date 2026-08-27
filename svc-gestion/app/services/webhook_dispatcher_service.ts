import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import type PaymentRequest from '#models/payment_request'
import WebhookDelivery, { type WebhookEventType } from '#models/webhook_delivery'
import { mintGestionJwt } from '#services/internal_jwt_service'
import { fetchWithTimeout } from '#services/fetch_with_timeout'
import { notifyOpsAlert } from '#services/ops_alert_service'

// Au-delà de ce délai depuis la première tentative, on arrête de rejouer
// et on alerte plutôt que d'échouer indéfiniment en silence.
const MAX_RETRY_AGE_HOURS = 24

export async function dispatchWebhook(
  paymentRequest: PaymentRequest,
  eventType: WebhookEventType
): Promise<WebhookDelivery> {
  const payload = {
    paymentRequestId: paymentRequest.id,
    sourceReference: paymentRequest.sourceReference,
    sourceService: paymentRequest.sourceService,
    status: paymentRequest.status,
    amountCents: paymentRequest.amountCents,
    paidAt: paymentRequest.paidAt ? paymentRequest.paidAt.toISO() : null,
  }

  const delivery = await WebhookDelivery.create({
    paymentRequestId: paymentRequest.id,
    eventType,
    targetUrl: paymentRequest.webhookUrl,
    payload,
    status: 'pending',
    attempts: 0,
  })

  await attemptDelivery(delivery, {
    orgId: paymentRequest.orgId,
    sourceService: paymentRequest.sourceService,
  })

  return delivery
}

export async function retryFailedDeliveries(): Promise<number> {
  const deliveries = await WebhookDelivery.query()
    .where('status', 'failed')
    .where('nextRetryAt', '<=', DateTime.now().toJSDate())
    .preload('paymentRequest')

  for (const delivery of deliveries) {
    if (!delivery.paymentRequest) continue
    await attemptDelivery(delivery, {
      orgId: delivery.paymentRequest.orgId,
      sourceService: delivery.paymentRequest.sourceService,
    })
  }

  return deliveries.length
}

export async function attemptDelivery(
  delivery: WebhookDelivery,
  target: { orgId: string; sourceService: string }
): Promise<void> {
  delivery.attempts += 1

  try {
    const token = await mintGestionJwt({
      orgId: target.orgId,
      scope: 'gestion',
      aud: `svc-${target.sourceService}`,
    })

    const response = await fetchWithTimeout(delivery.targetUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(delivery.payload),
    })

    if (!response.ok) {
      throw new Error(`réponse ${response.status}`)
    }

    delivery.status = 'delivered'
    delivery.deliveredAt = DateTime.now()
  } catch (error) {
    logger.warn(
      { deliveryId: delivery.id, targetUrl: delivery.targetUrl, error },
      'webhook_dispatcher: échec de livraison'
    )
    delivery.status = 'failed'

    const ageHours = DateTime.now().diff(delivery.createdAt, 'hours').hours
    if (ageHours >= MAX_RETRY_AGE_HOURS) {
      // nextRetryAt=null exclut la ligne de retryFailedDeliveries() (qui
      // filtre nextRetryAt <= now) sans avoir besoin d'un statut dédié.
      delivery.nextRetryAt = null
      await notifyOpsAlert(
        'Webhook abandonné après 24h',
        `Événement "${delivery.eventType}" vers ${delivery.targetUrl} (delivery #${delivery.id}) : ${delivery.attempts} tentatives échouées sur ${MAX_RETRY_AGE_HOURS}h, abandon.`
      )
    } else {
      // Backoff simple ; un job planifié pourra relire les "failed" plus tard.
      delivery.nextRetryAt = DateTime.now().plus({ minutes: 2 ** delivery.attempts })
    }
  }

  await delivery.save()
}
