import vine from '@vinejs/vine'

export const createOrganizationValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1),
    domain: vine.string().trim().minLength(1).toLowerCase(),
    adminEmail: vine.string().trim().email(),
    adminPassword: vine.string().minLength(6),
  })
)

// Renommer et/ou suspendre/réactiver un organisme — staff only (voir
// OrganizationsController#update). `suspendedMessage` n'a de sens qu'à la
// suspension (le contrôleur l'ignore/le vide à la réactivation).
export const updateOrganizationValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).optional(),
    status: vine.enum(['active', 'suspended'] as const).optional(),
    suspendedMessage: vine.string().trim().maxLength(300).nullable().optional(),
  })
)
