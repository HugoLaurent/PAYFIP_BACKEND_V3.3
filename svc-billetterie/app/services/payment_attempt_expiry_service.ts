import { DateTime } from 'luxon'
import OrderPaymentAttempt from '#models/order_payment_attempt'
import { refreshTenantRegistry } from '#services/tenant_registry_client'
import { runOnAllTenants } from '#services/tenant_connection_service'

// L'idOp PayFiP n'est valable que 15 min pour une seule redirection (voir
// openPayfipSession côté svc-gestion) — au-delà, une tentative encore
// "awaiting_payment" n'aboutira plus jamais, mais rien ne nous le dit
// explicitement (pas de webhook pour un abandon silencieux). Marge de 1
// min sur le seuil de balayage pour ne jamais couper une redirection
// encore légitimement en cours.
const STALE_AFTER_MINUTES = 16

export async function expireStalePaymentAttempts(): Promise<number> {
  await refreshTenantRegistry()

  const counts = await runOnAllTenants(async () => {
    const rows = await OrderPaymentAttempt.query()
      .where('status', 'awaiting_payment')
      .where('createdAt', '<', DateTime.now().minus({ minutes: STALE_AFTER_MINUTES }).toSQL()!)
      .update({ status: 'expired' }, ['id'])

    return rows.length
  })

  return counts.reduce((total, count) => total + count, 0)
}
