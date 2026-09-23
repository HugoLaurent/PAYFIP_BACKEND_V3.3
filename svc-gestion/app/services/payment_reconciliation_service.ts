import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import PaymentRequest from '#models/payment_request'
import PaymentResolutionAttempt from '#models/payment_resolution_attempt'
import { resolvePayment } from '#services/payment_resolution_service'

// Filet de sécurité pour le cas où ni urlnotif (jamais observé en
// environnement de test PayFiP à ce jour — 0 occurrence sur l'historique
// complet, très probablement un domaine pas encore intégré au proxy
// DGFiP, voir guide de mise en oeuvre PayFiP §2) ni urlredirect (citoyen
// qui ferme l'onglet PayFiP sans revenir) ne résolvent jamais le
// paiement : sans ça, le job d'expiration de chaque service aval
// (payment_attempt_expiry_service.ts) finit par marquer la commande
// "expired" alors que le paiement a réellement abouti, et plus rien ne
// peut jamais la rattraper (le webhook, quand il arrive enfin, refuse à
// raison de ressusciter une commande déjà expirée). Ce balayage doit donc
// tourner nettement plus vite que ce délai d'expiration (~16 min côté
// svc-billetterie/factures/inscription).
//
// recupererDetailPaiementSecurise est un simple lookup idempotent, sans
// effet de bord côté PayFiP (guide §3.5.2.6 : "Cet appel peut également
// être réalisé en dehors de toute notification pour connaître l'état du
// paiement en cours"). Testé en conditions réelles le 23/09/2026 : 4
// appels à 9s d'intervalle sur le même idOp, tous répondent 200 sans
// erreur ni throttling — la recommandation d'espacement de 30 min du
// guide (§3.5.2.6) vise les retentatives après une erreur technique
// (ex: 502), pas une limite réellement appliquée par PayFiP. On reste
// néanmoins raisonnable : un cooldown court évite de re-taper un paiement
// tout juste vérifié à chaque tour du scheduler.
const MAX_AGE_HOURS = 24 * 7
const RECHECK_COOLDOWN_MINUTES = 5

export async function reconcileStalePaymentRequests(): Promise<number> {
  const cutoff = DateTime.now().minus({ hours: MAX_AGE_HOURS })
  const cooldownCutoff = DateTime.now().minus({ minutes: RECHECK_COOLDOWN_MINUTES })

  const candidates = await PaymentRequest.query()
    .where('status', 'awaiting_payment')
    .where('createdAt', '>=', cutoff.toSQL()!)

  let reconciledCount = 0

  for (const paymentRequest of candidates) {
    if (!paymentRequest.payfipIdOp) continue

    const lastAttempt = await PaymentResolutionAttempt.query()
      .where('paymentRequestId', paymentRequest.id)
      .orderBy('calledAt', 'desc')
      .first()

    if (lastAttempt && lastAttempt.calledAt > cooldownCutoff) continue

    try {
      const resolved = await resolvePayment(paymentRequest.payfipIdOp, 'reconciliation')
      if (resolved && resolved.status !== 'awaiting_payment') reconciledCount++
    } catch (error) {
      // Une erreur sur un idOp ne doit jamais interrompre le balayage des
      // autres paiements encore en attente.
      logger.error(
        { err: error, paymentRequestId: paymentRequest.id },
        'reconcileStalePaymentRequests: échec pour un paiement'
      )
    }
  }

  return reconciledCount
}
