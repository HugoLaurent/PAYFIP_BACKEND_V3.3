import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { proxyRequest, proxyUpload } from '#services/proxy_service'
import { buildServicePermissions } from '#services/internal_jwt_service'

export default class ProfileController {
  async show(ctx: HttpContext) {
    const { orgId, userId } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${env.get('SVC_AUTH_BASE_URL')}/me`,
      jwt: { orgId: String(orgId), scope: 'auth', sub: String(userId), aud: 'svc-auth' },
    })
  }

  /** PATCH /auth/me — l'utilisateur connecté renseigne son propre prénom/nom. */
  async updateProfile(ctx: HttpContext) {
    const { orgId, userId } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${env.get('SVC_AUTH_BASE_URL')}/me`,
      jwt: { orgId: String(orgId), scope: 'auth', sub: String(userId), aud: 'svc-auth' },
    })
  }

  /** PATCH /auth/me/password — l'utilisateur connecté change son propre mot de passe. */
  async changeOwnPassword(ctx: HttpContext) {
    const { orgId, userId } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${env.get('SVC_AUTH_BASE_URL')}/me/password`,
      jwt: { orgId: String(orgId), scope: 'auth', sub: String(userId), aud: 'svc-auth' },
    })
  }

  /** GET /auth/users — un admin liste les agents de son propre organisme. */
  async listUsers(ctx: HttpContext) {
    const { orgId, userId, role } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${env.get('SVC_AUTH_BASE_URL')}/users`,
      jwt: { orgId: String(orgId), scope: 'auth', sub: String(userId), role, aud: 'svc-auth' },
      forwardQueryString: true,
    })
  }

  /** POST /auth/users — un admin ajoute un agent à son propre organisme. */
  async createUser(ctx: HttpContext) {
    const { orgId, userId, role } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${env.get('SVC_AUTH_BASE_URL')}/users`,
      jwt: { orgId: String(orgId), scope: 'auth', sub: String(userId), role, aud: 'svc-auth' },
    })
  }

  /**
   * GET /auth/services — un admin liste TOUS les services de son
   * organisme (y compris archivés) ; un agent uniquement ceux qui lui
   * sont assignés.
   */
  async listServices(ctx: HttpContext) {
    const { orgId, userId, role } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${env.get('SVC_AUTH_BASE_URL')}/services`,
      jwt: { orgId: String(orgId), scope: 'auth', sub: String(userId), role, aud: 'svc-auth' },
      forwardQueryString: true,
    })
  }

  /** GET /auth/services/:id — une fiche service, pour les liens profonds côté front. */
  async getService(ctx: HttpContext) {
    const { orgId, userId, role } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${env.get('SVC_AUTH_BASE_URL')}/services/${ctx.params.id}`,
      jwt: { orgId: String(orgId), scope: 'auth', sub: String(userId), role, aud: 'svc-auth' },
    })
  }

  /** PATCH /auth/services/:id — active/désactive un service de son organisme. */
  async updateService(ctx: HttpContext) {
    const { orgId, userId, role, services } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${env.get('SVC_AUTH_BASE_URL')}/services/${ctx.params.id}`,
      jwt: {
        orgId: String(orgId),
        scope: 'auth',
        sub: String(userId),
        role,
        servicePermissions: buildServicePermissions(services),
        aud: 'svc-auth',
      },
    })
  }

  /** POST /auth/services/:id/closures — ajoute une période de fermeture ponctuelle à un service de son organisme. */
  async createServiceClosure(ctx: HttpContext) {
    const { orgId, userId, role, services } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${env.get('SVC_AUTH_BASE_URL')}/services/${ctx.params.id}/closures`,
      jwt: {
        orgId: String(orgId),
        scope: 'auth',
        sub: String(userId),
        role,
        servicePermissions: buildServicePermissions(services),
        aud: 'svc-auth',
      },
    })
  }

  /** DELETE /auth/services/:id/closures/:closureId — retire une période de fermeture d'un service de son organisme. */
  async deleteServiceClosure(ctx: HttpContext) {
    const { orgId, userId, role, services } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${env.get('SVC_AUTH_BASE_URL')}/services/${ctx.params.id}/closures/${ctx.params.closureId}`,
      jwt: {
        orgId: String(orgId),
        scope: 'auth',
        sub: String(userId),
        role,
        servicePermissions: buildServicePermissions(services),
        aud: 'svc-auth',
      },
    })
  }

  /** POST /auth/services/:id/logo — un admin change le logo d'un de ses services. */
  async uploadServiceLogo(ctx: HttpContext) {
    const { orgId, userId, role } = ctx.clientAuth
    if (role !== 'admin') {
      return ctx.response.status(403).send({ error: 'admin_only' })
    }
    await proxyUpload(ctx, {
      targetUrl: `${env.get('SVC_AUTH_BASE_URL')}/services/${ctx.params.id}/logo`,
      jwt: { orgId: String(orgId), scope: 'auth', sub: String(userId), role, aud: 'svc-auth' },
    })
  }

  /** POST /auth/services/:id/cover — un admin change l'image de couverture d'un de ses services. */
  async uploadServiceCover(ctx: HttpContext) {
    const { orgId, userId, role } = ctx.clientAuth
    if (role !== 'admin') {
      return ctx.response.status(403).send({ error: 'admin_only' })
    }
    await proxyUpload(ctx, {
      targetUrl: `${env.get('SVC_AUTH_BASE_URL')}/services/${ctx.params.id}/cover`,
      jwt: { orgId: String(orgId), scope: 'auth', sub: String(userId), role, aud: 'svc-auth' },
      fileFieldName: 'cover',
    })
  }

  /** DELETE /auth/services/:id/cover — un admin retire l'image de couverture d'un de ses services. */
  async deleteServiceCover(ctx: HttpContext) {
    const { orgId, userId, role } = ctx.clientAuth
    if (role !== 'admin') {
      return ctx.response.status(403).send({ error: 'admin_only' })
    }
    await proxyRequest(ctx, {
      targetUrl: `${env.get('SVC_AUTH_BASE_URL')}/services/${ctx.params.id}/cover`,
      jwt: { orgId: String(orgId), scope: 'auth', sub: String(userId), role, aud: 'svc-auth' },
    })
  }

  /** PATCH /auth/users/:id — un admin édite les droits d'un agent de son organisme. */
  async updateUser(ctx: HttpContext) {
    const { orgId, userId, role } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${env.get('SVC_AUTH_BASE_URL')}/users/${ctx.params.id}`,
      jwt: { orgId: String(orgId), scope: 'auth', sub: String(userId), role, aud: 'svc-auth' },
    })
  }

  /** PATCH /auth/users/:id/password — un admin réinitialise le mot de passe d'un membre de son organisme. */
  async resetUserPassword(ctx: HttpContext) {
    const { orgId, userId, role } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${env.get('SVC_AUTH_BASE_URL')}/users/${ctx.params.id}/password`,
      jwt: { orgId: String(orgId), scope: 'auth', sub: String(userId), role, aud: 'svc-auth' },
    })
  }

  /** DELETE /auth/users/:id — un admin supprime un agent déjà désactivé de son organisme. */
  async deleteUser(ctx: HttpContext) {
    const { orgId, userId, role } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${env.get('SVC_AUTH_BASE_URL')}/users/${ctx.params.id}`,
      jwt: { orgId: String(orgId), scope: 'auth', sub: String(userId), role, aud: 'svc-auth' },
    })
  }
}
