import vine from '@vinejs/vine'

export const createOrganizationValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1),
    domain: vine.string().trim().minLength(1).toLowerCase(),
    adminEmail: vine.string().trim().email(),
    adminPassword: vine.string().minLength(6),
  })
)
