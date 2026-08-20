import vine from '@vinejs/vine'
import { ORDER_STATUSES } from '#database/enums'

export const createOrderValidator = vine.compile(
  vine.object({
    serviceId: vine.number().positive(),
    email: vine.string().trim().email(),
    visitDate: vine.date({ formats: ['YYYY-MM-DD'] }),
    tickets: vine
      .array(
        vine.object({
          tariffType: vine.string().trim().minLength(1),
          quantity: vine.number().positive(),
        })
      )
      .minLength(1),
    frontRedirectUrl: vine.string().trim().url({ require_tld: false }),
  })
)

export const listOrdersValidator = vine.compile(
  vine.object({
    serviceId: vine.number().positive(),
    status: vine.enum(ORDER_STATUSES).optional(),
    q: vine.string().trim().minLength(1).optional(),
    dateFrom: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
    dateTo: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
    page: vine.number().positive().optional(),
    perPage: vine.number().positive().max(100).optional(),
  })
)

export const listOrdersStaffValidator = vine.compile(
  vine.object({
    orgId: vine.number().positive().optional(),
    serviceId: vine.number().positive().optional(),
    status: vine.enum(ORDER_STATUSES).optional(),
    q: vine.string().trim().minLength(1).optional(),
    dateFrom: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
    dateTo: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
    page: vine.number().positive().optional(),
    perPage: vine.number().positive().max(100).optional(),
  })
)

export const retryOrderPaymentValidator = vine.compile(
  vine.object({
    frontRedirectUrl: vine.string().trim().url({ require_tld: false }),
  })
)

export const scanOrderValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(1),
  })
)

export const agentSaleValidator = vine.compile(
  vine.object({
    serviceId: vine.number().positive(),
    email: vine.string().trim().email(),
    visitDate: vine.date({ formats: ['YYYY-MM-DD'] }),
    tickets: vine
      .array(
        vine.object({
          tariffType: vine.string().trim().minLength(1),
          quantity: vine.number().positive(),
        })
      )
      .minLength(1),
    paymentMethod: vine.enum(['cash', 'card', 'check', 'other', 'free'] as const),
  })
)
