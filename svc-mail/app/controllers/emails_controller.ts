import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import EmailDelivery from '#models/email_delivery'
import { sendEmailValidator } from '#validators/email'
import { attemptDelivery } from '#services/email_dispatcher_service'

export default class EmailsController {
  async send(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(sendEmailValidator)

    if (env.get('MAIL_MODE') !== 'real') {
      logger.info(
        { template: payload.template, to: payload.to },
        'emails: mode fake, email non envoyé'
      )
      // Conservé (jamais réellement envoyé) pour la page de
      // prévisualisation staff — voir StaffController#getEmail.
      await EmailDelivery.create({
        template: payload.template,
        toEmail: payload.to,
        data: payload.data,
        attachments: payload.attachments ?? null,
        status: 'fake',
        attempts: 0,
      })
      return ctx.response.send({ data: { sent: false, reason: 'fake_mode' } })
    }

    const delivery = await EmailDelivery.create({
      template: payload.template,
      toEmail: payload.to,
      data: payload.data,
      attachments: payload.attachments ?? null,
      status: 'pending',
      attempts: 0,
    })

    await attemptDelivery(delivery)

    if (delivery.status !== 'sent') {
      return ctx.response.status(502).send({ error: 'mail_send_failed' })
    }

    return ctx.response.send({ data: { sent: true } })
  }
}
