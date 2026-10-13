import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { proxyRequest } from '#services/proxy_service'
import { orgIdValidator } from '#validators/org_id'

const base = () => env.get('SVC_INSCRIPTION_BASE_URL')
const authBase = () => env.get('SVC_AUTH_BASE_URL')

async function orgIdFromQuery(ctx: HttpContext): Promise<string> {
  const { orgId } = await orgIdValidator.validate({ orgId: ctx.request.qs().orgId })
  return String(orgId)
}

async function orgIdFromBody(ctx: HttpContext): Promise<string> {
  const { orgId } = await orgIdValidator.validate({ orgId: ctx.request.input('orgId') })
  return String(orgId)
}

export default class InscriptionPublicsController {
  async serviceLookup(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${authBase()}/services/lookup/${ctx.params.slug}`,
    })
  }

  async otpRequest(ctx: HttpContext) {
    const orgId = await orgIdFromBody(ctx)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/otp/request`,
      jwt: { orgId, scope: 'inscription', aud: 'svc-inscription' },
    })
  }

  async otpVerify(ctx: HttpContext) {
    const orgId = await orgIdFromBody(ctx)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/otp/verify`,
      jwt: { orgId, scope: 'inscription', aud: 'svc-inscription' },
    })
  }

  async listEvents(ctx: HttpContext) {
    const orgId = await orgIdFromQuery(ctx)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/events`,
      jwt: { orgId, scope: 'inscription', aud: 'svc-inscription' },
      forwardQueryString: true,
    })
  }

  async showEventBySlug(ctx: HttpContext) {
    const orgId = await orgIdFromQuery(ctx)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/events/by-slug/${ctx.params.slug}`,
      jwt: { orgId, scope: 'inscription', aud: 'svc-inscription' },
      forwardQueryString: true,
    })
  }

  async showEvent(ctx: HttpContext) {
    const orgId = await orgIdFromQuery(ctx)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/events/${ctx.params.id}`,
      jwt: { orgId, scope: 'inscription', aud: 'svc-inscription' },
      forwardQueryString: true,
    })
  }

  async createRegistration(ctx: HttpContext) {
    const orgId = await orgIdFromBody(ctx)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/registrations`,
      jwt: { orgId, scope: 'inscription', aud: 'svc-inscription' },
    })
  }

  /**
   * Retour PayFiP : le front n'a que sourceReference + idop dans l'URL,
   * pas l'accessToken (même position que orderTicketsByReference côté
   * billetterie).
   */
  async registrationByReference(ctx: HttpContext) {
    const orgId = await orgIdFromQuery(ctx)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/registrations/by-reference/${ctx.params.reference}`,
      jwt: { orgId, scope: 'inscription', aud: 'svc-inscription' },
      forwardQueryString: true,
    })
  }

  async registrationByToken(ctx: HttpContext) {
    const orgId = await orgIdFromQuery(ctx)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/registrations/by-token/${ctx.params.accessToken}`,
      jwt: { orgId, scope: 'inscription', aud: 'svc-inscription' },
      forwardQueryString: true,
    })
  }

  async cancelRegistration(ctx: HttpContext) {
    const orgId = await orgIdFromBody(ctx)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/registrations/by-token/${ctx.params.accessToken}/cancel`,
      jwt: { orgId, scope: 'inscription', aud: 'svc-inscription' },
    })
  }

  async payRegistration(ctx: HttpContext) {
    const orgId = await orgIdFromBody(ctx)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/registrations/by-token/${ctx.params.accessToken}/pay`,
      jwt: { orgId, scope: 'inscription', aud: 'svc-inscription' },
    })
  }

  async retryRegistrationPayment(ctx: HttpContext) {
    const orgId = await orgIdFromBody(ctx)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/registrations/by-token/${ctx.params.accessToken}/retry-payment`,
      jwt: { orgId, scope: 'inscription', aud: 'svc-inscription' },
    })
  }

  async downloadAttestation(ctx: HttpContext) {
    const orgId = await orgIdFromQuery(ctx)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/registrations/by-token/${ctx.params.accessToken}/attestation`,
      jwt: { orgId, scope: 'inscription', aud: 'svc-inscription' },
      forwardQueryString: true,
      binary: true,
    })
  }
}
