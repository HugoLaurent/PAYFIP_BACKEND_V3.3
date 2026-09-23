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

/**
 * Bascule un payment_request encore awaiting_payment vers expired — pour
 * un idOp que PayFiP a confirmé mort (FonctionnelleErreur P1) ou dont la
 * fenêtre de mise en relation (expiresAt, 15 min) est dépassée sans
 * résolution. Appelée uniquement par payment_reconciliation_service.ts,
 * jamais depuis resolvePayment() : celle-ci ne fait que refléter ce que
 * PayFiP répond, l'expiration est une décision temporelle qui lui est
 * extérieure.
 *
 * Même mécanique transactionnelle que resolvePayment() (update
 * conditionnel + webhook) pour que /retry et l'idempotence de store()
 * (qui excluent finalFailureStatuses = failed/cancelled/expired) se
 * débloquent enfin — sans ça, un citoyen qui abandonne avant de payer
 * reste bloqué indéfiniment : /retry répond 409 ("pas dans un état
 * retentable"), et un nouvel appel à store() renvoie par idempotence
 * l'ancien idOp, mort depuis longtemps.
 */
export async function expireStalePaymentRequest(
  paymentRequest: PaymentRequest
): Promise<PaymentRequest> {
  const rows = await db
    .from('payment_requests')
    .where('id', paymentRequest.id)
    .whereNotIn('status', PaymentRequest.finalStatuses)
    .update({ status: 'expired', updated_at: DateTime.now().toSQL() }, ['*'])

  if (rows.length > 0) {
    await paymentRequest.refresh()
    await dispatchWebhook(paymentRequest, 'paiement.echec')
    return paymentRequest
  }

  await paymentRequest.refresh()
  return paymentRequest
}
