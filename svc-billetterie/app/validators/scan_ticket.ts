import vine from '@vinejs/vine'

export const scanTicketValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(1),
  })
)

export const listScansValidator = vine.compile(
  vine.object({
    serviceId: vine.number().positive(),
    dateFrom: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
    dateTo: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
    // Utilisé par l'écran Scanner (l'agent sur le terrain ne veut voir
    // que ce qu'il vient de faire, pas l'activité de tout le service) —
    // l'Historique admin n'envoie jamais ce paramètre, il voit tout le
    // monde.
    mine: vine.boolean().optional(),
    page: vine.number().positive().optional(),
    perPage: vine.number().positive().max(100).optional(),
  })
)
