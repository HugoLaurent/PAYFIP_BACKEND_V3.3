import vine from '@vinejs/vine'

export const depositBudgetCodesValidator = vine.compile(
  vine.object({
    codes: vine
      .array(
        vine.object({
          numcli: vine.string().trim().minLength(1),
          // Résout le service précis visé — le numcli seul peut être
          // partagé entre plusieurs services d'un même organisme, voir
          // aregie_controller.ts#deposit.
          linkCode: vine.string().trim().minLength(1),
          code: vine.string().trim().minLength(1),
          label: vine.string().trim().minLength(1),
        })
      )
      .minLength(1),
  })
)
