import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { proxyRequest } from '#services/proxy_service'

const auth = () => env.get('SVC_AUTH_BASE_URL')
const billetterie = () => env.get('SVC_BILLETTERIE_BASE_URL')
const factures = () => env.get('SVC_FACTURES_BASE_URL')
const gestion = () => env.get('SVC_GESTION_BASE_URL')
const mail = () => env.get('SVC_MAIL_BASE_URL')

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

  async listUsers(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${auth()}/users`,
      jwt: { orgId: '', scope: 'staff', aud: 'svc-auth' },
      forwardQueryString: true,
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
}
