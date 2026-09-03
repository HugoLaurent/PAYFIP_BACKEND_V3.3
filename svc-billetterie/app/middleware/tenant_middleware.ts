import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Point d'accroche pour une résolution de tenant avant le contrôleur —
 * volontairement inerte ici. `ctx.internalAuth.serviceIds` est un
 * TABLEAU (les services accessibles à un agent), jamais un serviceId
 * unique : aucune route à ressource unique (order/ticket/tariff par id)
 * ne peut se résoudre à une seule base tenant avant d'avoir chargé la
 * ressource. Chaque contrôleur résout donc son tenant lui-même — via un
 * code opaque qui l'embarque (order_code_service.ts/ticket_code_service.ts),
 * via un fan-out borné sur serviceIds/l'organisme
 * (tenant_connection_service.ts), ou directement quand serviceId est déjà
 * un paramètre explicite de la requête (ex. POST /services/:id/tariffs).
 * Voir la même décision, pour la même raison, dans svc-factures.
 */
export default class TenantMiddleware {
  async handle(_ctx: HttpContext, next: NextFn) {
    return next()
  }
}
