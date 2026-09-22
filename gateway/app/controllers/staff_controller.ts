import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { proxyRequest, proxyUpload } from '#services/proxy_service'

const auth = () => env.get('SVC_AUTH_BASE_URL')
const billetterie = () => env.get('SVC_BILLETTERIE_BASE_URL')
const factures = () => env.get('SVC_FACTURES_BASE_URL')
const gestion = () => env.get('SVC_GESTION_BASE_URL')
const mail = () => env.get('SVC_MAIL_BASE_URL')
const inscription = () => env.get('SVC_INSCRIPTION_BASE_URL')

export default class StaffController {
  async listOrganizations(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${auth()}/organizations`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-auth' },
    })
  }

  async createOrganization(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${auth()}/organizations`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-auth' },
    })
  }

  async updateOrganization(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${auth()}/organizations/${ctx.params.id}`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-auth' },
    })
  }

  async deleteOrganization(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${auth()}/organizations/${ctx.params.id}`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-auth' },
    })
  }

  async createService(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${auth()}/organizations/${ctx.params.id}/services`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-auth' },
    })
  }

  async listServices(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${auth()}/services`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-auth' },
      forwardQueryString: true,
    })
  }

  async updateService(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${auth()}/services/${ctx.params.id}`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-auth' },
    })
  }

  async createServiceClosure(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${auth()}/services/${ctx.params.id}/closures`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-auth' },
    })
  }

  async deleteServiceClosure(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${auth()}/services/${ctx.params.id}/closures/${ctx.params.closureId}`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-auth' },
    })
  }

  async uploadServiceLogo(ctx: HttpContext) {
    await proxyUpload(ctx, {
      targetUrl: `${auth()}/services/${ctx.params.id}/logo`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-auth' },
    })
  }

  async uploadServiceCover(ctx: HttpContext) {
    await proxyUpload(ctx, {
      targetUrl: `${auth()}/services/${ctx.params.id}/cover`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-auth' },
      fileFieldName: 'cover',
    })
  }

  async deleteServiceCover(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${auth()}/services/${ctx.params.id}/cover`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-auth' },
    })
  }

  async createTariff(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${billetterie()}/services/${ctx.params.id}/tariffs`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-billetterie' },
    })
  }

  async updateTariff(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${billetterie()}/tariffs/${ctx.params.id}`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-billetterie' },
      forwardQueryString: true,
    })
  }

  async deleteTariff(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${billetterie()}/tariffs/${ctx.params.id}`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-billetterie' },
      forwardQueryString: true,
    })
  }

  async listBudgetCodesForService(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${billetterie()}/budget-codes`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-billetterie' },
      forwardQueryString: true,
    })
  }

  async resetTicketScan(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${billetterie()}/tickets/${ctx.params.id}/reset-scan`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-billetterie' },
      forwardQueryString: true,
    })
  }

  async refundTicket(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${billetterie()}/tickets/${ctx.params.id}/refund`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-billetterie' },
      forwardQueryString: true,
    })
  }

  async createEvent(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${inscription()}/services/${ctx.params.id}/events`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-inscription' },
    })
  }

  async updateEvent(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${inscription()}/events/${ctx.params.id}`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-inscription' },
      forwardQueryString: true,
    })
  }

  async cancelEvent(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${inscription()}/events/${ctx.params.id}/cancel`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-inscription' },
      forwardQueryString: true,
    })
  }

  async deleteEvent(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${inscription()}/events/${ctx.params.id}`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-inscription' },
      forwardQueryString: true,
    })
  }

  async listUsers(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${auth()}/users`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-auth' },
      forwardQueryString: true,
    })
  }

  async createUser(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${auth()}/users`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-auth' },
    })
  }

  async updateUser(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${auth()}/users/${ctx.params.id}`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-auth' },
    })
  }

  async resetUserPassword(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${auth()}/users/${ctx.params.id}/password`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-auth' },
    })
  }

  async deleteUser(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${auth()}/users/${ctx.params.id}`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-auth' },
    })
  }

  async listOrders(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${billetterie()}/orders/staff`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-billetterie' },
      forwardQueryString: true,
    })
  }

  async listInvoices(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${factures()}/invoices/staff`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-factures' },
      forwardQueryString: true,
    })
  }

  async invoicePaymentAttempts(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${factures()}/invoices/staff/${ctx.params.id}/payment-attempts`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-factures' },
      forwardQueryString: true,
    })
  }

  async listRegistrations(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${inscription()}/registrations/staff`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-inscription' },
      forwardQueryString: true,
    })
  }

  async registrationPaymentAttempts(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${inscription()}/registrations/staff/${ctx.params.id}/payment-attempts`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-inscription' },
      forwardQueryString: true,
    })
  }

  async listPaymentRequests(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${gestion()}/payment-requests/staff`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-gestion' },
      forwardQueryString: true,
    })
  }

  async listEmails(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${mail()}/emails/staff`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-mail' },
      forwardQueryString: true,
    })
  }

  async getEmail(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${mail()}/emails/staff/${ctx.params.id}`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-mail' },
    })
  }

  async getAregieMailSettings(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${mail()}/settings/aregie-mail`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-mail' },
    })
  }

  async updateAregieMailSettings(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${mail()}/settings/aregie-mail`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-mail' },
    })
  }

  async getServiceAregieMailKey(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${auth()}/services/${ctx.params.id}/aregie-mail-key`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-auth' },
    })
  }

  async updateServiceAregieMailKey(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${auth()}/services/${ctx.params.id}/aregie-mail-key`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-auth' },
    })
  }

  async deleteServiceAregieMailKey(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${auth()}/services/${ctx.params.id}/aregie-mail-key`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-auth' },
    })
  }
}
