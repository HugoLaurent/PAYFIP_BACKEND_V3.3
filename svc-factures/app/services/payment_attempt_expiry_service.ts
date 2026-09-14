import { DateTime } from 'luxon'
import InvoicePaymentAttempt from '#models/invoice_payment_attempt'
import { refreshTenantRegistry, getTenantConfig } from '#services/tenant_registry_client'
import { runOnAllTenants } from '#services/tenant_connection_service'
import { listPaymentAttempts } from '#services/svc_gestion_client'

// L'idOp PayFiP n'est valable que 15 min pour une seule redirection —
// au-delà, une tentative encore "awaiting_payment" n'aboutira plus
// jamais, mais rien ne nous le dit explicitement (pas de webhook pour un
// abandon silencieux). Marge de 1 min sur le seuil de balayage pour ne
// jamais couper une redirection encore légitimement en cours.
const STALE_AFTER_MINUTES = 16

export async function expireStalePaymentAttempts(): Promise<number> {
  await refreshTenantRegistry()

  const counts = await runOnAllTenants(async (serviceId) => {
    const staleAttempts = await InvoicePaymentAttempt.query()
      .where('status', 'awaiting_payment')
      .where('createdAt', '<', DateTime.now().minus({ minutes: STALE_AFTER_MINUTES }).toSQL()!)
      .preload('invoice')

    let expiredCount = 0
    for (const attempt of staleAttempts) {
      if (await wasActuallyPaid(serviceId, attempt)) continue
      attempt.status = 'expired'
      await attempt.save()
      expiredCount++
    }
    return expiredCount
  })

  return counts.reduce((total, count) => total + count, 0)
}

/**
 * Avant d'expirer une tentative, on revérifie auprès de svc-gestion : le
 * webhook qui nous préviendrait d'un paiement réussi peut légitimement
 * mettre plus de 16 min à arriver (backoff de webhook_dispatcher_service,
 * jusqu'à 24h) sans que le paiement ait échoué pour autant. On ne veut
 * jamais expirer localement — ce qui débloque un nouveau paiement côté
 * usager, donc un risque de double prélèvement — un idOp dont svc-gestion
 * sait qu'il a en réalité été payé. En cas de doute (svc-gestion
 * injoignable, référence introuvable), on revient au comportement
 * d'avant : on expire quand même, pour ne jamais bloquer indéfiniment un
 * usager sur une tentative réellement morte.
 */
async function wasActuallyPaid(
  serviceId: number,
  attempt: InvoicePaymentAttempt
): Promise<boolean> {
  const reference = attempt.invoice?.paymentReference
  if (!reference) return false

  const config = await getTenantConfig(serviceId)
  if (!config) return false

  try {
    const attempts = await listPaymentAttempts(String(config.orgId), reference)
    return attempts.some((a) => a.id === attempt.paymentRequestId && a.status === 'paid')
  } catch {
    return false
  }
}
