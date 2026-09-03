import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Point d'accroche pour la résolution de tenant avant le contrôleur —
 * volontairement inerte pour svc-factures (voir F4 du plan de migration
 * DB-per-tenant) : aucune de ses routes ne connaît son serviceId avant
 * d'avoir chargé la ressource elle-même — verify()/pay()/byReference()/
 * retryPayment()/paymentWebhook() résolvent leur tenant via une
 * référence opaque ou un fan-out borné par organisme (voir
 * tenant_connection_service.ts), pas via ce middleware. Contrairement à
 * svc-billetterie/svc-inscription (qui reçoivent `serviceIds` dans le
 * JWT interne et peuvent résoudre leur tenant ici), ce middleware n'est
 * donc PAS attaché aux routes de svc-factures pour l'instant — il existe
 * pour que le prochain service splitté ait le même seam à câbler juste
 * après internal_jwt_middleware.
 */
export default class TenantMiddleware {
  async handle(_ctx: HttpContext, next: NextFn) {
    return next()
  }
}
