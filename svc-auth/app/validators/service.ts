import vine from '@vinejs/vine'

export const createServiceValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1),
    serviceType: vine.enum(['billetterie', 'factures'] as const),
    numcli: vine.string().trim().regex(/^\d{6}$/),
    saisieMode: vine.enum(['T', 'X', 'W'] as const).optional(),
    slug: vine
      .string()
      .trim()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .optional(),
  })
)

export const updateServiceValidator = vine.compile(
  vine.object({
    status: vine.enum(['active', 'archived'] as const),
  })
)
