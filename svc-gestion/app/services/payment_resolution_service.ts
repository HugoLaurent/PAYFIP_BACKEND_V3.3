import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import PaymentRequest, { type PaymentRequestStatus } from '#models/payment_request'
import PaymentResolutionAttempt, {
  type ResolutionTrigger,
} from '#models/payment_resolution_attempt'
import payfipClient, { type PayfipResolutionStatus } from '#services/payfip/index'
import { dispatchWebhook } from '#services/webhook_dispatcher_service'

function mapPayfipStatus(status: PayfipResolutionStatus): PaymentRequestStatus | null {
  if (status === 'paid') return 'paid'
  if (status === 'failed') return 'failed'
  return null
}

export async function resolvePayment(
  idOp: string,
  trigger: ResolutionTrigger
): Promise<PaymentRequest | null> {
  const paymentRequest = await PaymentRequest.findBy('payfipIdOp', idOp)

  if (!paymentRequest) {
    logger.warn({ idOp, trigger }, 'resolvePayment: idOp inconnu')
    return null
  }

  const result = await payfipClient.recupererDetailPaiementSecurise(idOp)

  await PaymentResolutionAttempt.create({
    paymentRequestId: paymentRequest.id,
    trigger,
    payfipResultCode: result.resultCode,
    resultingStatus: result.status,
    rawResponse: result.raw,
    calledAt: DateTime.now(),
  })

  const nextStatus = mapPayfipStatus(result.status)
  if (!nextStatus) {
    return paymentRequest
  }

  const rows = await db
    .from('payment_requests')
    .where('id', paymentRequest.id)
    .whereNotIn('status', PaymentRequest.finalStatuses)
    .update(
      {
        status: nextStatus,
        paid_at: nextStatus === 'paid' ? DateTime.now().toSQL() : null,
        updated_at: DateTime.now().toSQL(),
      },
      ['*']
    )

  if (rows.length > 0) {
    await paymentRequest.refresh()
    await dispatchWebhook(
      paymentRequest,
      nextStatus === 'paid' ? 'paiement.valide' : 'paiement.echec'
    )
    return paymentRequest
  }

  await paymentRequest.refresh()
  return paymentRequest
}
