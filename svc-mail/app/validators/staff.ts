import vine from '@vinejs/vine'
import { EMAIL_DELIVERY_STATUSES } from '#database/enums'

export const listEmailsStaffValidator = vine.compile(
  vine.object({
    status: vine.enum(EMAIL_DELIVERY_STATUSES).optional(),
    q: vine.string().trim().minLength(1).optional(),
    dateFrom: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
    dateTo: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
    page: vine.number().positive().optional(),
    perPage: vine.number().positive().max(100).optional(),
  })
)
