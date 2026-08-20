import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { proxyRequest } from '#services/proxy_service'

const base = () => env.get('SVC_GESTION_BASE_URL')

export default class PaiementPublicsController {
  async notify(ctx: HttpContext) {
    await proxyRequest(ctx, { targetUrl: `${base()}/payfip/notify`, forwardQueryString: true })
  }

  /**
   * GET /paiement/payfip/return — retour navigateur (URLREDIRECT).
   * svc-gestion répond par une 302 ; on la retransmet telle quelle sans
   * la suivre nous-mêmes (voir proxy_service).
   */
  async returnCallback(ctx: HttpContext) {
    await proxyRequest(ctx, { targetUrl: `${base()}/payfip/return`, forwardQueryString: true })
  }

  /**
   * GET /paiement/status/:idop — pollé par le front (onglet A). orgId
   * n'est pas vérifié par svc-gestion sur cette route ; on met une
   * valeur neutre le temps de brancher une vraie résolution d'organisme.
   */
  async status(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${base()}/payfip/status/${ctx.params.idop}`,
      jwt: { orgId: '0', scope: 'billetterie', aud: 'svc-gestion' },
    })
  }
}
