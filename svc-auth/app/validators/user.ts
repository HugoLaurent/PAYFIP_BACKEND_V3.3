import vine from '@vinejs/vine'

export const createAgentValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email(),
    password: vine.string().minLength(6),
    firstName: vine.string().trim().minLength(1).maxLength(100),
    lastName: vine.string().trim().minLength(1).maxLength(100),
    // Un admin n'est rattaché à aucun service (accès complet d'office) —
    // serviceIds ne s'applique qu'au rôle par défaut 'agent', vérifié à
    // la main dans le contrôleur plutôt que rendu obligatoire ici.
    role: vine.enum(['agent', 'admin'] as const).optional(),
    serviceIds: vine.array(vine.number().positive()).optional(),
    canSell: vine.boolean().optional(),
    canScan: vine.boolean().optional(),
    canManageTariffs: vine.boolean().optional(),
    canViewHistory: vine.boolean().optional(),
    canToggleService: vine.boolean().optional(),
  })
)

export const updateOwnProfileValidator = vine.compile(
  vine.object({
    firstName: vine.string().trim().minLength(1).maxLength(100),
    lastName: vine.string().trim().minLength(1).maxLength(100),
  })
)

export const listUsersValidator = vine.compile(
  vine.object({
    orgId: vine.number().positive().optional(),
    q: vine.string().trim().optional(),
    page: vine.number().positive().optional(),
    perPage: vine.number().positive().max(100).optional(),
  })
)

export const updateAgentPermissionsValidator = vine.compile(
  vine.object({
    firstName: vine.string().trim().minLength(1).maxLength(100).optional(),
    lastName: vine.string().trim().minLength(1).maxLength(100).optional(),
    // 'deleted' n'est jamais accepté ici — c'est une action distincte
    // (DELETE /users/:id), pas un statut qu'on repasse au vol.
    status: vine.enum(['active', 'inactive'] as const).optional(),
    // Absent pour un admin, qui n'a aucune permission par service à gérer.
    services: vine
      .array(
        vine.object({
          serviceId: vine.number().positive(),
          canSell: vine.boolean().optional(),
          canScan: vine.boolean().optional(),
          canManageTariffs: vine.boolean().optional(),
          canViewHistory: vine.boolean().optional(),
          canToggleService: vine.boolean().optional(),
        })
      )
      .optional(),
  })
)

export const setPasswordValidator = vine.compile(
  vine.object({
    newPassword: vine.string().minLength(6),
  })
)

export const changeOwnPasswordValidator = vine.compile(
  vine.object({
    currentPassword: vine.string().minLength(1),
    newPassword: vine.string().minLength(6),
  })
)
