import vine from '@vinejs/vine'

export const paymentWebhookValidator = vine.compile(
  vine.object({
    paymentRequestId: vine.number(),
    sourceReference: vine.string().trim().minLength(1),
    sourceService: vine.string().trim(),
    status: vine.enum(['paid', 'failed'] as const),
    amountCents: vine.number(),
    paidAt: vine.string().trim().nullable().optional(),
  })
)
