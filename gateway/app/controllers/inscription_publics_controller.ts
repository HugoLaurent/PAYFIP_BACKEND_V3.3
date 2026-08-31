import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { proxyRequest, proxyMultipartUpload } from '#services/proxy_service'

const base = () => env.get('SVC_INSCRIPTION_BASE_URL')
const authBase = () => env.get('SVC_AUTH_BASE_URL')

export default class InscriptionPublicsController {
  async serviceLookup(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${authBase()}/services/lookup/${ctx.params.slug}`,
    })
  }

  async otpRequest(ctx: HttpContext) {
    const orgId = String(ctx.request.input('orgId'))
    await proxyRequest(ctx, {
      targetUrl: `${base()}/otp/request`,
      jwt: { orgId, scope: 'inscription', aud: 'svc-inscription' },
    })
  }

  async otpVerify(ctx: HttpContext) {
    const orgId = String(ctx.request.input('orgId'))
    await proxyRequest(ctx, {
      targetUrl: `${base()}/otp/verify`,
      jwt: { orgId, scope: 'inscription', aud: 'svc-inscription' },
    })
  }

  async listEvents(ctx: HttpContext) {
    const orgId = String(ctx.request.qs().orgId)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/events`,
      jwt: { orgId, scope: 'inscription', aud: 'svc-inscription' },
      forwardQueryString: true,
    })
  }

  async showEventBySlug(ctx: HttpContext) {
    const orgId = String(ctx.request.qs().orgId)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/events/by-slug/${ctx.params.slug}`,
      jwt: { orgId, scope: 'inscription', aud: 'svc-inscription' },
      forwardQueryString: true,
    })
  }

  async showEvent(ctx: HttpContext) {
    const orgId = String(ctx.request.qs().orgId)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/events/${ctx.params.id}`,
      jwt: { orgId, scope: 'inscription', aud: 'svc-inscription' },
      forwardQueryString: true,
    })
  }

  async createRegistration(ctx: HttpContext) {
    const orgId = String(ctx.request.input('orgId'))
    await proxyRequest(ctx, {
      targetUrl: `${base()}/registrations`,
      jwt: { orgId, scope: 'inscription', aud: 'svc-inscription' },
    })
  }

  /**
   * Dépôt initial d'inscription avec justificatifs — multipart, un fichier
   * par exigence nommée (clé = DocumentRequirement.key, jusqu'à 5), plus
   * les champs texte de l'inscription à côté (voir proxyMultipartUpload :
   * proxyRequest ne relaie que du JSON).
   */
  async createRegistrationWithDocuments(ctx: HttpContext) {
    const orgId = String(ctx.request.input('orgId'))
    await proxyMultipartUpload(ctx, {
      targetUrl: `${base()}/registrations/with-documents`,
      jwt: { orgId, scope: 'inscription', aud: 'svc-inscription' },
      maxSize: '8mb',
      extnames: ['pdf', 'png', 'jpg', 'jpeg'],
      fields: ['eventId', 'email', 'firstName', 'lastName', 'quantity', 'formResponses', 'frontRedirectUrl'],
    })
  }

  /**
   * Retour PayFiP : le front n'a que sourceReference + idop dans l'URL,
   * pas l'accessToken (même position que orderTicketsByReference côté
   * billetterie).
   */
  async registrationByReference(ctx: HttpContext) {
    const orgId = String(ctx.request.qs().orgId)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/registrations/by-reference/${ctx.params.reference}`,
      jwt: { orgId, scope: 'inscription', aud: 'svc-inscription' },
      forwardQueryString: true,
    })
  }

  async registrationByToken(ctx: HttpContext) {
    const orgId = String(ctx.request.qs().orgId)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/registrations/by-token/${ctx.params.accessToken}`,
      jwt: { orgId, scope: 'inscription', aud: 'svc-inscription' },
      forwardQueryString: true,
    })
  }

  /** Re-dépôt de justificatifs après rejet — même contrainte multipart que le dépôt initial. */
  async replaceRegistrationDocuments(ctx: HttpContext) {
    const orgId = String(ctx.request.input('orgId'))
    await proxyMultipartUpload(ctx, {
      targetUrl: `${base()}/registrations/by-token/${ctx.params.accessToken}/documents`,
      jwt: { orgId, scope: 'inscription', aud: 'svc-inscription' },
      maxSize: '8mb',
      extnames: ['pdf', 'png', 'jpg', 'jpeg'],
      fields: [],
    })
  }

  async cancelRegistration(ctx: HttpContext) {
    const orgId = String(ctx.request.input('orgId'))
    await proxyRequest(ctx, {
      targetUrl: `${base()}/registrations/by-token/${ctx.params.accessToken}/cancel`,
      jwt: { orgId, scope: 'inscription', aud: 'svc-inscription' },
    })
  }

  async payRegistration(ctx: HttpContext) {
    const orgId = String(ctx.request.input('orgId'))
    await proxyRequest(ctx, {
      targetUrl: `${base()}/registrations/by-token/${ctx.params.accessToken}/pay`,
      jwt: { orgId, scope: 'inscription', aud: 'svc-inscription' },
    })
  }

  async retryRegistrationPayment(ctx: HttpContext) {
    const orgId = String(ctx.request.input('orgId'))
    await proxyRequest(ctx, {
      targetUrl: `${base()}/registrations/by-token/${ctx.params.accessToken}/retry-payment`,
      jwt: { orgId, scope: 'inscription', aud: 'svc-inscription' },
    })
  }

  async downloadAttestation(ctx: HttpContext) {
    const orgId = String(ctx.request.qs().orgId)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/registrations/by-token/${ctx.params.accessToken}/attestation`,
      jwt: { orgId, scope: 'inscription', aud: 'svc-inscription' },
      forwardQueryString: true,
      binary: true,
    })
  }
}
