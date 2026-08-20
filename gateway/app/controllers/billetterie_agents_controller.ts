import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { proxyRequest } from '#services/proxy_service'
import { buildServicePermissions } from '#services/internal_jwt_service'

const base = () => env.get('SVC_BILLETTERIE_BASE_URL')

export default class BilletterieAgentsController {
  async listOrders(ctx: HttpContext) {
    const { orgId, role, services } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${base()}/orders`,
      jwt: {
        orgId: String(orgId),
        scope: 'billetterie',
        role,
        servicePermissions: buildServicePermissions(services),
        aud: 'svc-billetterie',
      },
      forwardQueryString: true,
    })
  }

  /** GET /billetterie/orders/stats — indicateurs du mois, tous services confondus. */
  async orderStats(ctx: HttpContext) {
    const { orgId, role, services } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${base()}/orders/stats`,
      jwt: {
        orgId: String(orgId),
        scope: 'billetterie',
        role,
        servicePermissions: buildServicePermissions(services),
        serviceIds: services.map((s) => s.id),
        aud: 'svc-billetterie',
      },
    })
  }

  async agentSale(ctx: HttpContext) {
    const { orgId, userId, role, services, email, firstName, lastName } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${base()}/orders/agent-sale`,
      jwt: {
        orgId: String(orgId),
        scope: 'billetterie',
        sub: String(userId),
        role,
        servicePermissions: buildServicePermissions(services),
        serviceIds: services.map((s) => s.id),
        agentEmail: email,
        agentFirstName: firstName,
        agentLastName: lastName,
        aud: 'svc-billetterie',
      },
    })
  }

  /** POST /billetterie/orders/:id/resend-confirmation — renvoie l'email au client. */
  async resendConfirmation(ctx: HttpContext) {
    const { orgId, userId, role, services } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${base()}/orders/${ctx.params.id}/resend-confirmation`,
      jwt: {
        orgId: String(orgId),
        scope: 'billetterie',
        sub: String(userId),
        role,
        servicePermissions: buildServicePermissions(services),
        serviceIds: services.map((s) => s.id),
        aud: 'svc-billetterie',
      },
    })
  }

  /** GET /billetterie/orders/:id/agent-tickets-pdf — les billets en PDF, pour l'agent qui vient de vendre. */
  async agentTicketsPdf(ctx: HttpContext) {
    const { orgId, userId, role, services } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${base()}/orders/${ctx.params.id}/agent-tickets-pdf`,
      jwt: {
        orgId: String(orgId),
        scope: 'billetterie',
        sub: String(userId),
        role,
        servicePermissions: buildServicePermissions(services),
        serviceIds: services.map((s) => s.id),
        aud: 'svc-billetterie',
      },
      binary: true,
    })
  }

  async scanTicket(ctx: HttpContext) {
    const { orgId, userId, role, services, email, firstName, lastName } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${base()}/tickets/scan`,
      jwt: {
        orgId: String(orgId),
        scope: 'billetterie',
        sub: String(userId),
        role,
        servicePermissions: buildServicePermissions(services),
        serviceIds: services.map((s) => s.id),
        agentEmail: email,
        agentFirstName: firstName,
        agentLastName: lastName,
        aud: 'svc-billetterie',
      },
    })
  }

  /** POST /billetterie/orders/scan — un agent scanne le QR d'une commande entière (tous ses billets d'un coup). */
  async scanOrder(ctx: HttpContext) {
    const { orgId, userId, role, services } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${base()}/orders/scan`,
      jwt: {
        orgId: String(orgId),
        scope: 'billetterie',
        sub: String(userId),
        role,
        servicePermissions: buildServicePermissions(services),
        serviceIds: services.map((s) => s.id),
        aud: 'svc-billetterie',
      },
    })
  }

  /** POST /billetterie/tickets/:id/reset-scan — remet un billet déjà scanné en valide (re-entrée). */
  async resetScan(ctx: HttpContext) {
    const { orgId, userId, role, services, email, firstName, lastName } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${base()}/tickets/${ctx.params.id}/reset-scan`,
      jwt: {
        orgId: String(orgId),
        scope: 'billetterie',
        sub: String(userId),
        role,
        servicePermissions: buildServicePermissions(services),
        serviceIds: services.map((s) => s.id),
        agentEmail: email,
        agentFirstName: firstName,
        agentLastName: lastName,
        aud: 'svc-billetterie',
      },
    })
  }

  /** GET /billetterie/scans — historique des scans d'un service, le plus récent en premier. */
  async listScans(ctx: HttpContext) {
    const { orgId, userId, role, services } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${base()}/scans`,
      jwt: {
        orgId: String(orgId),
        scope: 'billetterie',
        sub: String(userId),
        role,
        servicePermissions: buildServicePermissions(services),
        aud: 'svc-billetterie',
      },
      forwardQueryString: true,
    })
  }

  /**
   * GET /billetterie/services/:id/tariffs — vue de gestion (admin/agent),
   * inclut les tarifs désactivés contrairement à la route publique
   * /billetterie/tariffs (jamais utilisée pour la gestion, réservée aux
   * citoyens).
   */
  async listTariffs(ctx: HttpContext) {
    const { orgId, role, services } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${base()}/tariffs?serviceId=${ctx.params.id}&includeArchived=true`,
      jwt: {
        orgId: String(orgId),
        scope: 'billetterie',
        role,
        servicePermissions: buildServicePermissions(services),
        aud: 'svc-billetterie',
      },
    })
  }

  /**
   * POST /billetterie/services/:id/tariffs — le rôle est propagé jusqu'à
   * svc-billetterie, qui tranche seul si 'admin' est requis.
   */
  async createTariff(ctx: HttpContext) {
    const { orgId, userId, role, services } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${base()}/services/${ctx.params.id}/tariffs`,
      jwt: {
        orgId: String(orgId),
        scope: 'billetterie',
        sub: String(userId),
        role,
        servicePermissions: buildServicePermissions(services),
        serviceIds: services.map((s) => s.id),
        aud: 'svc-billetterie',
      },
    })
  }

  /** PATCH /billetterie/tariffs/:id — prix et/ou statut d'un tarif existant. */
  async updateTariff(ctx: HttpContext) {
    const { orgId, userId, role, services } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${base()}/tariffs/${ctx.params.id}`,
      jwt: {
        orgId: String(orgId),
        scope: 'billetterie',
        sub: String(userId),
        role,
        servicePermissions: buildServicePermissions(services),
        serviceIds: services.map((s) => s.id),
        aud: 'svc-billetterie',
      },
    })
  }

  /** DELETE /billetterie/tariffs/:id — suppression définitive (tarif déjà désactivé). */
  async deleteTariff(ctx: HttpContext) {
    const { orgId, userId, role, services } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${base()}/tariffs/${ctx.params.id}`,
      jwt: {
        orgId: String(orgId),
        scope: 'billetterie',
        sub: String(userId),
        role,
        servicePermissions: buildServicePermissions(services),
        serviceIds: services.map((s) => s.id),
        aud: 'svc-billetterie',
      },
    })
  }

  /**
   * GET /billetterie/orders/:id/payment-attempts — détail des tentatives
   * de paiement d'une commande, pour rassurer un client qui a payé
   * plusieurs fois.
   */
  async orderPaymentAttempts(ctx: HttpContext) {
    const { orgId, role, services } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${base()}/orders/${ctx.params.id}/payment-attempts`,
      jwt: {
        orgId: String(orgId),
        scope: 'billetterie',
        role,
        servicePermissions: buildServicePermissions(services),
        aud: 'svc-billetterie',
      },
    })
  }

  /** GET /billetterie/budget-codes?numcli=X — liste à choisir en créant un tarif. */
  async listBudgetCodes(ctx: HttpContext) {
    const { orgId, userId, role, services } = ctx.clientAuth
    await proxyRequest(ctx, {
      targetUrl: `${base()}/budget-codes`,
      jwt: {
        orgId: String(orgId),
        scope: 'billetterie',
        sub: String(userId),
        role,
        servicePermissions: buildServicePermissions(services),
        serviceIds: services.map((s) => s.id),
        aud: 'svc-billetterie',
      },
      forwardQueryString: true,
    })
  }
}
