import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { proxyRequest } from '#services/proxy_service'
import { buildServicePermissions } from '#services/internal_jwt_service'

const base = () => env.get('SVC_INSCRIPTION_BASE_URL')

export default class InscriptionAgentsController {
  /** GET /inscription/services/:id/events — tous statuts, gestion agent. */
  async listEvents(ctx: HttpContext) {
    const { orgId, role, services } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${base()}/events?serviceId=${ctx.params.id}`,
      jwt: {
        orgId: String(orgId),
        scope: 'inscription',
        role,
        servicePermissions: buildServicePermissions(services),
        aud: 'svc-inscription',
      },
    })
  }

  async createEvent(ctx: HttpContext) {
    const { orgId, userId, role, services } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${base()}/services/${ctx.params.id}/events`,
      jwt: {
        orgId: String(orgId),
        scope: 'inscription',
        sub: String(userId),
        role,
        servicePermissions: buildServicePermissions(services),
        serviceIds: services.map((s) => s.id),
        aud: 'svc-inscription',
      },
    })
  }

  async updateEvent(ctx: HttpContext) {
    const { orgId, userId, role, services } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${base()}/events/${ctx.params.id}`,
      jwt: {
        orgId: String(orgId),
        scope: 'inscription',
        sub: String(userId),
        role,
        servicePermissions: buildServicePermissions(services),
        serviceIds: services.map((s) => s.id),
        aud: 'svc-inscription',
      },
    })
  }

  async cancelEvent(ctx: HttpContext) {
    const { orgId, userId, role, services } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${base()}/events/${ctx.params.id}/cancel`,
      jwt: {
        orgId: String(orgId),
        scope: 'inscription',
        sub: String(userId),
        role,
        servicePermissions: buildServicePermissions(services),
        serviceIds: services.map((s) => s.id),
        aud: 'svc-inscription',
      },
    })
  }

  async deleteEvent(ctx: HttpContext) {
    const { orgId, userId, role, services } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${base()}/events/${ctx.params.id}`,
      jwt: {
        orgId: String(orgId),
        scope: 'inscription',
        sub: String(userId),
        role,
        servicePermissions: buildServicePermissions(services),
        serviceIds: services.map((s) => s.id),
        aud: 'svc-inscription',
      },
    })
  }

  /** GET /inscription/events/:id/registrations — résumé des inscrits, filtrable. */
  async listRegistrations(ctx: HttpContext) {
    const { orgId, role, services } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${base()}/events/${ctx.params.id}/registrations`,
      jwt: {
        orgId: String(orgId),
        scope: 'inscription',
        role,
        servicePermissions: buildServicePermissions(services),
        aud: 'svc-inscription',
      },
      forwardQueryString: true,
    })
  }

  /** POST /inscription/registrations/:id/review — {decision:'approve'|'reject', rejectionReason?}. */
  async reviewRegistration(ctx: HttpContext) {
    const { orgId, userId, role, services, email, firstName, lastName } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${base()}/registrations/${ctx.params.id}/review`,
      jwt: {
        orgId: String(orgId),
        scope: 'inscription',
        sub: String(userId),
        role,
        servicePermissions: buildServicePermissions(services),
        serviceIds: services.map((s) => s.id),
        agentEmail: email,
        agentFirstName: firstName,
        agentLastName: lastName,
        aud: 'svc-inscription',
      },
    })
  }

  async downloadDocument(ctx: HttpContext) {
    const { orgId, role, services } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${base()}/registrations/${ctx.params.id}/documents/${ctx.params.documentId}`,
      jwt: {
        orgId: String(orgId),
        scope: 'inscription',
        role,
        servicePermissions: buildServicePermissions(services),
        aud: 'svc-inscription',
      },
      binary: true,
    })
  }
}
