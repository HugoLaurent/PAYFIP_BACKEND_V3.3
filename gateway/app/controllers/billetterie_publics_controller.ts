import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { proxyRequest } from '#services/proxy_service'

const base = () => env.get('SVC_BILLETTERIE_BASE_URL')
const authBase = () => env.get('SVC_AUTH_BASE_URL')

export default class BilletteriePublicsController {
  async serviceLookup(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${authBase()}/services/lookup/${ctx.params.slug}`,
    })
  }

  async otpRequest(ctx: HttpContext) {
    const orgId = String(ctx.request.input('orgId'))
    await proxyRequest(ctx, {
      targetUrl: `${base()}/otp/request`,
      jwt: { orgId, scope: 'billetterie', aud: 'svc-billetterie' },
    })
  }

  async otpVerify(ctx: HttpContext) {
    const orgId = String(ctx.request.input('orgId'))
    await proxyRequest(ctx, {
      targetUrl: `${base()}/otp/verify`,
      jwt: { orgId, scope: 'billetterie', aud: 'svc-billetterie' },
    })
  }

  async tariffs(ctx: HttpContext) {
    const orgId = String(ctx.request.qs().orgId)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/tariffs`,
      jwt: { orgId, scope: 'billetterie', aud: 'svc-billetterie' },
      forwardQueryString: true,
    })
  }

  async createOrder(ctx: HttpContext) {
    const orgId = String(ctx.request.input('orgId'))
    await proxyRequest(ctx, {
      targetUrl: `${base()}/orders`,
      jwt: { orgId, scope: 'billetterie', aud: 'svc-billetterie' },
    })
  }

  async orderTickets(ctx: HttpContext) {
    const orgId = String(ctx.request.qs().orgId)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/orders/${ctx.params.id}/tickets`,
      jwt: { orgId, scope: 'billetterie', aud: 'svc-billetterie' },
      forwardQueryString: true,
    })
  }

  /**
   * Retour PayFiP : le front n'a que l'idOp dans l'URL, pas l'orderId ni
   * même l'orgId au départ — voir paiement/status pour la première étape.
   */
  async orderTicketsByReference(ctx: HttpContext) {
    const orgId = String(ctx.request.qs().orgId)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/orders/by-reference/${ctx.params.reference}/tickets`,
      jwt: { orgId, scope: 'billetterie', aud: 'svc-billetterie' },
      forwardQueryString: true,
    })
  }

  async ticketPdf(ctx: HttpContext) {
    const orgId = String(ctx.request.qs().orgId)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/orders/${ctx.params.id}/tickets/${ctx.params.ticketId}/pdf`,
      jwt: { orgId, scope: 'billetterie', aud: 'svc-billetterie' },
      forwardQueryString: true,
      binary: true,
    })
  }

  async ticketPdfByReference(ctx: HttpContext) {
    const orgId = String(ctx.request.qs().orgId)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/orders/by-reference/${ctx.params.reference}/tickets/${ctx.params.ticketId}/pdf`,
      jwt: { orgId, scope: 'billetterie', aud: 'svc-billetterie' },
      forwardQueryString: true,
      binary: true,
    })
  }

  /** Tous les billets d'une commande fusionnés en un seul PDF. */
  async ticketsPdf(ctx: HttpContext) {
    const orgId = String(ctx.request.qs().orgId)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/orders/${ctx.params.id}/tickets/pdf`,
      jwt: { orgId, scope: 'billetterie', aud: 'svc-billetterie' },
      forwardQueryString: true,
      binary: true,
    })
  }

  async ticketsPdfByReference(ctx: HttpContext) {
    const orgId = String(ctx.request.qs().orgId)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/orders/by-reference/${ctx.params.reference}/tickets/pdf`,
      jwt: { orgId, scope: 'billetterie', aud: 'svc-billetterie' },
      forwardQueryString: true,
      binary: true,
    })
  }

  /**
   * Nouvel essai après un paiement refusé/annulé : même position que
   * orderTicketsByReference — le front n'a que sourceReference + idOp
   * (retour PayFiP), pas d'orgId authentifié.
   */
  async retryOrderPayment(ctx: HttpContext) {
    const orgId = String(ctx.request.qs().orgId)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/orders/by-reference/${ctx.params.reference}/retry-payment`,
      jwt: { orgId, scope: 'billetterie', aud: 'svc-billetterie' },
      forwardQueryString: true,
    })
  }

  /**
   * Dépôt AREGIE des codes budgétaires — authentifié par la clé Bearer
   * d'AREGIE (aregieAuth côté svc-billetterie), pas par un JWT interne :
   * on relaie l'en-tête tel quel, svc-billetterie fait la vérification.
   */
  async aregieDepositBudgetCodes(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${base()}/aregie/budget-codes`,
      forwardAuthorization: true,
    })
  }
}
