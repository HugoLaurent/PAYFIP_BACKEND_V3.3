import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import { resolvePayment } from '#services/payment_resolution_service'

const idOpValidator = vine.compile(vine.object({ idop: vine.string().trim().minLength(1) }))

const allowedOrigins = new Set(
  env
    .get('FRONT_ALLOWED_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
)

export default class PayfipCallbacksController {
  async notify(ctx: HttpContext) {
    const { idop } = await idOpValidator.validate({
      idop: ctx.request.input('idOp') ?? ctx.request.qs().idop,
    })

    await resolvePayment(idop, 'urlnotif')

    return ctx.response.status(200).send({ received: true })
  }

  async return(ctx: HttpContext) {
    const { idop } = await idOpValidator.validate({ idop: ctx.request.qs().idop })

    const paymentRequest = await resolvePayment(idop, 'urlredirect')

    if (!paymentRequest) {
      return ctx.response.status(404).send({ error: 'unknown_idop' })
    }

    const destination = new URL(paymentRequest.frontRedirectUrl)

    if (!allowedOrigins.has(destination.origin)) {
      logger.warn(
        { origin: destination.origin, paymentRequestId: paymentRequest.id },
        'return: frontRedirectUrl hors whitelist, redirection refusée'
      )
      return ctx.response.status(400).send({ error: 'redirect_origin_not_allowed' })
    }

    destination.searchParams.set('idop', idop)
    destination.searchParams.set('status', paymentRequest.status)
    destination.searchParams.set('orgId', paymentRequest.orgId)
    destination.searchParams.set('sourceService', paymentRequest.sourceService)
    destination.searchParams.set('sourceReference', paymentRequest.sourceReference)

    return ctx.response.redirect(destination.toString())
  }
}
