import type { HttpContext } from '@adonisjs/core/http'
import EmailDelivery from '#models/email_delivery'
import { listEmailsStaffValidator } from '#validators/staff'

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
}
