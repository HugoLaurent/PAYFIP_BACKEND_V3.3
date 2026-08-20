import vine from '@vinejs/vine'
import { SOURCE_SERVICES, PAYMENT_REQUEST_STATUSES } from '#database/enums'

export const createPaymentRequestValidator = vine.compile(
  vine.object({
    serviceId: vine.number().positive(),
    sourceReference: vine.string().trim().minLength(6).maxLength(30),
    amountCents: vine.number().positive(),
    objectLabel: vine.string().trim().minLength(1).maxLength(99),
    payerEmail: vine.string().trim().email().minLength(6).maxLength(80),
    exer: vine.number().min(2000).max(2999).optional(),
    frontRedirectUrl: vine.string().trim().url({ require_tld: false }),
    webhookUrl: vine.string().trim().url({ require_tld: false }),
  })
)

export const listPaymentRequestsStaffValidator = vine.compile(
  vine.object({
    orgId: vine.string().trim().optional(),
    sourceService: vine.enum(SOURCE_SERVICES).optional(),
    serviceId: vine.number().positive().optional(),
    status: vine.enum(PAYMENT_REQUEST_STATUSES).optional(),
    q: vine.string().trim().minLength(1).optional(),
    dateFrom: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
    dateTo: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
    page: vine.number().positive().optional(),
    perPage: vine.number().positive().max(100).optional(),
  })
)
