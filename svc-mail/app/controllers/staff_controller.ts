import type { HttpContext } from '@adonisjs/core/http'
import EmailDelivery from '#models/email_delivery'
import { listEmailsStaffValidator } from '#validators/staff'
import { renderMailTemplate, type MailTemplateName } from '#services/mail_template_registry'

export default class StaffController {
  async index(ctx: HttpContext) {
    if (ctx.internalAuth.scope !== 'staff') {
      return ctx.response.status(403).send({ error: 'scope_not_allowed' })
    }

    const { status, q, dateFrom, dateTo, page, perPage } = await ctx.request.validateUsing(
      listEmailsStaffValidator
    )

    const query = EmailDelivery.query().orderBy('id', 'desc')
    if (status) query.where('status', status)
    if (q) query.whereLike('toEmail', `%${q}%`)
    if (dateFrom) query.where('createdAt', '>=', dateFrom.toJSDate())
    if (dateTo) query.where('createdAt', '<=', dateTo.plus({ days: 1 }).toJSDate())

    const deliveries = await query.paginate(page ?? 1, perPage ?? 25)

    return ctx.response.send({
      data: deliveries.all().map((d) => ({
        id: d.id,
        template: d.template,
        toEmail: d.toEmail,
        status: d.status,
        attempts: d.attempts,
        error: d.error,
        createdAt: d.createdAt.toISO(),
        sentAt: d.sentAt?.toISO() ?? null,
      })),
      meta: deliveries.getMeta(),
    })
  }

  /**
   * GET /emails/staff/:id — contenu rendu d'un envoi (sujet/HTML), pour la
   * page de prévisualisation staff. `template` est toujours une valeur de
   * MAIL_TEMPLATE_NAMES à l'écriture (sendEmailValidator) — cast sûr.
   */
  async show(ctx: HttpContext) {
    if (ctx.internalAuth.scope !== 'staff') {
      return ctx.response.status(403).send({ error: 'scope_not_allowed' })
    }

    const delivery = await EmailDelivery.find(Number(ctx.params.id))
    if (!delivery) {
      return ctx.response.status(404).send({ error: 'email_not_found' })
    }

    const rendered = await renderMailTemplate(delivery.template as MailTemplateName, delivery.data)

    return ctx.response.send({
      data: {
        id: delivery.id,
        template: delivery.template,
        toEmail: delivery.toEmail,
        status: delivery.status,
        subject: rendered.subject,
        html: rendered.html,
      },
    })
  }
}
