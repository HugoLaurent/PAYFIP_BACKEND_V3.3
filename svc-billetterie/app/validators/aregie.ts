import vine from '@vinejs/vine'

export const depositBudgetCodesValidator = vine.compile(
  vine.object({
    codes: vine
      .array(
        vine.object({
          numcli: vine.string().trim().minLength(1),
          code: vine.string().trim().minLength(1),
          label: vine.string().trim().minLength(1),
        })
      )
      .minLength(1),
  })
)
