import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import PaymentRequest from '#models/payment_request'
import PaymentResolutionAttempt from '#models/payment_resolution_attempt'
import { expireStalePaymentRequest, resolvePayment } from '#services/payment_resolution_service'

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
//
// Les 15 min citées dans le guide ne concernent que la mise en relation
// initiale (ouverture de la page de paiement) — le lookup de résultat,
// lui, reste valide jusqu'à 1 an pour un idOp qui a vraiment atteint le
// prestataire de télépaiement (guide §3.5.2.6). En revanche, un idOp
// abandonné AVANT d'y arriver est supprimé côté PayFiP dès la nuit
// suivante : recupererDetailPaiementSecurise répond alors une
// FonctionnelleErreur "P1 : IdOp incorrect" (à distinguer de "P5 :
// résultat pas encore connu", légitime — voir envelope.ts et
// real_client.spec.ts). Un idOp qui répond P1 ne redeviendra jamais
// valide.
//
// Ni resolvePayment() ni ce job ne faisaient jamais expirer un
// payment_request auparavant — un citoyen qui abandonne avant de payer
// restait "awaiting_payment" pour toujours, et /retry comme
// l'idempotence de store() (qui excluent tous deux finalFailureStatuses
// = failed/cancelled/expired) refusaient indéfiniment de repartir sur
// une base saine. Deux cas déclenchent maintenant expireStalePaymentRequest :
// un P1 confirmé (mort à coup sûr, quel que soit expiresAt), ou
// expiresAt dépassé après une vérification réelle auprès de PayFiP qui
// ne l'a pas résolu (P5 éternel, ou idOp jamais utilisé).
const MAX_AGE_HOURS = 24 * 7
const RECHECK_COOLDOWN_MINUTES = 5
const DEAD_IDOP_RESULT_CODE = 'P1'

export async function reconcileStalePaymentRequests(): Promise<number> {
  const cutoff = DateTime.now().minus({ hours: MAX_AGE_HOURS })
  const cooldownCutoff = DateTime.now().minus({ minutes: RECHECK_COOLDOWN_MINUTES })
  const now = DateTime.now()

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

    if (lastAttempt?.payfipResultCode === DEAD_IDOP_RESULT_CODE) {
      await expireStalePaymentRequest(paymentRequest)
      reconciledCount++
      continue
    }
    if (lastAttempt && lastAttempt.calledAt > cooldownCutoff) continue

    try {
      const resolved = await resolvePayment(paymentRequest.payfipIdOp, 'reconciliation')

      if (resolved && resolved.status !== 'awaiting_payment') {
        reconciledCount++
        continue
      }

      // Toujours awaiting_payment après une vérification réelle auprès
      // de PayFiP (pas juste une supposition locale) : si la fenêtre de
      // mise en relation est dépassée, cet idOp ne pourra plus jamais
      // aboutir.
      if (paymentRequest.expiresAt && paymentRequest.expiresAt < now) {
        await expireStalePaymentRequest(paymentRequest)
        reconciledCount++
      }
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
