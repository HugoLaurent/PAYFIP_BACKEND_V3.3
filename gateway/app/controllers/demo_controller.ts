import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { loginWithCredentials } from '#services/svc_auth_client'
import { mintClientToken } from '#services/client_jwt_service'
import { proxyRequest } from '#services/proxy_service'

const mail = () => env.get('SVC_MAIL_BASE_URL')

// Bootstrap sans mot de passe pour les démos commerciales — jamais actif
// sans DEMO_MODE=true explicite (absent par défaut, y compris en prod).
// Aucune route ici n'exige d'authentification : c'est le but (émettre une
// session sans que l'utilisateur n'ait rien à saisir).
function demoEnabled(): boolean {
  return env.get('DEMO_MODE') === true
}

export default class DemoController {
  async status(ctx: HttpContext) {
    return ctx.response.send({ data: { enabled: demoEnabled() } })
  }

  async config(ctx: HttpContext) {
    if (!demoEnabled()) {
      return ctx.response.status(404).send({ error: 'demo_mode_disabled' })
    }
    return ctx.response.send({
      data: {
        journeys: {
          billetterie: env.get('DEMO_BILLETTERIE_PATH') ?? null,
          inscription: env.get('DEMO_INSCRIPTION_PATH') ?? null,
          factures: env.get('DEMO_FACTURES_PATH') ?? null,
        },
        // Repris tel quel par le widget en query string des liens de
        // parcours, pour préremplir l'email (et le nom, côté inscription)
        // plutôt que de le taper en direct devant un client. Valeurs par
        // défaut plausibles si non configurées — jamais un vrai email.
        citizen: {
          email: env.get('DEMO_CITIZEN_EMAIL') ?? 'jean.dupont@exemple.test',
          firstName: env.get('DEMO_CITIZEN_FIRST_NAME') ?? 'Jean',
          lastName: env.get('DEMO_CITIZEN_LAST_NAME') ?? 'Dupont',
        },
      },
    })
  }

  /**
   * GET /demo/example-email?template=... — un exemple d'email rendu
   * (factice, jamais un envoi réel), pour que le widget puisse en montrer
   * un sans navigation ni connexion staff.
   */
  async exampleEmail(ctx: HttpContext) {
    if (!demoEnabled()) {
      return ctx.response.status(404).send({ error: 'demo_mode_disabled' })
    }
    await proxyRequest(ctx, {
      targetUrl: `${mail()}/emails/example`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-mail' },
      forwardQueryString: true,
    })
  }

  /**
   * Émet une session admin d'organisme sans que le widget démo n'ait à
   * connaître de mot de passe : contourne délibérément POST /auth/login
   * (et son middleware.loginRateLimit()) puisqu'un widget cliqué plusieurs
   * fois par jour pendant des démos le ferait sauter — le mot de passe
   * reste côté serveur (DEMO_ADMIN_PASSWORD), jamais renvoyé au navigateur.
   */
  async adminLogin(ctx: HttpContext) {
    if (!demoEnabled()) {
      return ctx.response.status(404).send({ error: 'demo_mode_disabled' })
    }
    const email = env.get('DEMO_ADMIN_EMAIL')
    const password = env.get('DEMO_ADMIN_PASSWORD')
    if (!email || !password) {
      return ctx.response.status(404).send({ error: 'demo_admin_not_configured' })
    }

    const result = await loginWithCredentials(email, password)
    if (!result) {
      return ctx.response.status(404).send({ error: 'demo_admin_not_configured' })
    }

    const token = await mintClientToken(result)

    return ctx.response.send({
      data: {
        token,
        userId: result.userId,
        orgId: result.orgId,
        orgName: result.orgName,
        email: result.email,
        firstName: result.firstName,
        lastName: result.lastName,
        role: result.role,
        services: result.services,
        passwordChangeRequired: result.passwordChangeRequired,
      },
    })
  }
}
