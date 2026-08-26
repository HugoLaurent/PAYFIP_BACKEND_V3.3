import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import {
  buildAuthorizeUrl,
  completeOidcLogin,
  generateNonce,
  signOidcState,
  verifyOidcState,
} from '#services/staff_oidc_service'
import { mintStaffToken } from '#services/staff_jwt_service'

export default class StaffAuthController {
  // Point d'entrée : redirige vers Authentik. Le nonce est encodé dans le
  // `state` lui-même (JWT auto-signé, voir staff_oidc_service) plutôt que
  // conservé côté serveur — la Gateway n'a pas de session.
  async login(ctx: HttpContext) {
    const nonce = generateNonce()
    const state = await signOidcState(nonce)
    const url = await buildAuthorizeUrl(state, nonce)
    return ctx.response.redirect(url)
  }

  // Retour d'Authentik : échange le code, vérifie le id_token (signature,
  // issuer, audience, nonce, appartenance au groupe payfip-staff), émet un
  // JWT de session propre à la Gateway, et renvoie le navigateur vers le
  // front avec ce token dans le fragment d'URL (jamais en query string —
  // un fragment n'est ni loggé côté serveur ni transmis dans un Referer).
  async callback(ctx: HttpContext) {
    const code = ctx.request.input('code')
    const state = ctx.request.input('state')
    const errorParam = ctx.request.input('error')

    const frontendUrl = env.get('STAFF_FRONTEND_REDIRECT_URL')

    if (errorParam || typeof code !== 'string' || typeof state !== 'string') {
      return ctx.response.redirect(`${frontendUrl}#error=oidc_error`)
    }

    const stateData = await verifyOidcState(state)
    if (!stateData) {
      return ctx.response.redirect(`${frontendUrl}#error=invalid_state`)
    }

    const identity = await completeOidcLogin(code, stateData.nonce)
    if (!identity) {
      return ctx.response.redirect(`${frontendUrl}#error=oidc_denied`)
    }

    const token = await mintStaffToken(identity)
    return ctx.response.redirect(`${frontendUrl}#token=${encodeURIComponent(token)}`)
  }
}
