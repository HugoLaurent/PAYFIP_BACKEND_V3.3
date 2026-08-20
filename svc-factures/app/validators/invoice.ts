import vine from '@vinejs/vine'
import { INVOICE_STATUSES } from '#database/enums'

export const verifyInvoiceValidator = vine.compile(
  vine.object({
    hospitalReference: vine.string().trim().minLength(1),
    fiscalYear: vine.number(),
    amountCents: vine.number().positive(),
  })
)

export const payInvoiceValidator = vine.compile(
  vine.object({
    frontRedirectUrl: vine.string().trim().url({ require_tld: false }),
    payerEmail: vine.string().trim().email().minLength(6).maxLength(80),
    fiscalYear: vine.number(),
    amountCents: vine.number().positive(),
  })
)

export const retryInvoicePaymentValidator = vine.compile(
  vine.object({
    frontRedirectUrl: vine.string().trim().url({ require_tld: false }),
  })
)

export const listInvoicesStaffValidator = vine.compile(
  vine.object({
    orgId: vine.number().positive().optional(),
    serviceId: vine.number().positive().optional(),
    status: vine.enum(INVOICE_STATUSES).optional(),
    q: vine.string().trim().minLength(1).optional(),
    dateFrom: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
    dateTo: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
    page: vine.number().positive().optional(),
    perPage: vine.number().positive().max(100).optional(),
  })
)
