import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { proxyRequest } from '#services/proxy_service'

export default class ServicesPublicsController {
  /** GET /services/:id/logo — public, relayé tel quel (pas de JWT interne, la route cible ne l'exige pas). */
  async logo(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${env.get('SVC_AUTH_BASE_URL')}/services/${ctx.params.id}/logo`,
      binary: true,
    })
  }

  /** GET /services/:id/cover — public, relayé tel quel, même logique que logo(). */
  async cover(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${env.get('SVC_AUTH_BASE_URL')}/services/${ctx.params.id}/cover`,
      binary: true,
    })
  }
}
