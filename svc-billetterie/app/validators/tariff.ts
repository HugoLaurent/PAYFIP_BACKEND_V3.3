import vine from '@vinejs/vine'

export const createTariffValidator = vine.compile(
  vine.object({
    tariffType: vine.string().trim().minLength(1),
    priceCents: vine.number().min(0),
    numcli: vine.string().trim().minLength(1),
    budgetCode: vine.string().trim().minLength(1),
  })
)

export const listBudgetCodesValidator = vine.compile(
  vine.object({
    numcli: vine.string().trim().minLength(1),
    serviceId: vine.number().positive(),
  })
)

export const updateTariffValidator = vine.compile(
  vine.object({
    priceCents: vine.number().min(0).optional(),
    status: vine.enum(['active', 'archived'] as const).optional(),
  })
)
