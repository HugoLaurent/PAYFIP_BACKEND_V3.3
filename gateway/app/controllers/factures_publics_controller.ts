import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { proxyRequest } from '#services/proxy_service'
import { orgIdValidator } from '#validators/org_id'

const base = () => env.get('SVC_FACTURES_BASE_URL')
const authBase = () => env.get('SVC_AUTH_BASE_URL')

async function orgIdFromQuery(ctx: HttpContext): Promise<string> {
  const { orgId } = await orgIdValidator.validate({ orgId: ctx.request.qs().orgId })
  return String(orgId)
}

async function orgIdFromBody(ctx: HttpContext): Promise<string> {
  const { orgId } = await orgIdValidator.validate({ orgId: ctx.request.input('orgId') })
  return String(orgId)
}

export default class FacturesPublicsController {
  /** GET /factures/services/lookup/:slug — même lookup générique que la billetterie, juste un point d'entrée différent. */
  async serviceLookup(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${authBase()}/services/lookup/${ctx.params.slug}`,
    })
  }

  async otpRequest(ctx: HttpContext) {
    const orgId = await orgIdFromBody(ctx)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/otp/request`,
      jwt: { orgId, scope: 'factures', aud: 'svc-factures' },
    })
  }

  async otpVerify(ctx: HttpContext) {
    const orgId = await orgIdFromBody(ctx)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/otp/verify`,
      jwt: { orgId, scope: 'factures', aud: 'svc-factures' },
    })
  }

  async verify(ctx: HttpContext) {
    const orgId = await orgIdFromBody(ctx)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/invoices/verify`,
      jwt: { orgId, scope: 'factures', aud: 'svc-factures' },
    })
  }

  async pay(ctx: HttpContext) {
    const orgId = await orgIdFromBody(ctx)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/invoices/${ctx.params.id}/pay`,
      jwt: { orgId, scope: 'factures', aud: 'svc-factures' },
    })
  }

  /**
   * Retour PayFiP : le front n'a que l'idOp dans l'URL, voir
   * paiement/status pour la première étape (orgId, sourceReference).
   */
  async byReference(ctx: HttpContext) {
    const orgId = await orgIdFromQuery(ctx)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/invoices/by-reference/${ctx.params.reference}`,
      jwt: { orgId, scope: 'factures', aud: 'svc-factures' },
      forwardQueryString: true,
    })
  }

  /**
   * Nouvel essai après un paiement refusé/annulé : même position que
   * byReference — le front n'a que sourceReference + idOp (retour PayFiP).
   */
  async retryInvoicePayment(ctx: HttpContext) {
    const orgId = await orgIdFromQuery(ctx)
    await proxyRequest(ctx, {
      targetUrl: `${base()}/invoices/by-reference/${ctx.params.reference}/retry-payment`,
      jwt: { orgId, scope: 'factures', aud: 'svc-factures' },
      forwardQueryString: true,
    })
  }

  /**
   * Trois routes AREGIE — authentifiées par la clé Bearer d'AREGIE
   * (aregieAuth côté svc-factures), pas par un JWT interne : on relaie
   * l'en-tête tel quel, svc-factures fait la vérification.
   */
  async aregieDepositInvoices(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${base()}/aregie/invoices`,
      forwardAuthorization: true,
    })
  }

  async aregiePendingCollection(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${base()}/aregie/invoices/paid`,
      forwardAuthorization: true,
    })
  }

  async aregieAcknowledgeCollection(ctx: HttpContext) {
    await proxyRequest(ctx, {
      targetUrl: `${base()}/aregie/invoices/collected`,
      forwardAuthorization: true,
    })
  }
}
