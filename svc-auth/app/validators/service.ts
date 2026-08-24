import vine from '@vinejs/vine'

export const createServiceValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1),
    serviceType: vine.enum(['billetterie', 'factures'] as const),
    numcli: vine
      .string()
      .trim()
      .regex(/^\d{6}$/),
    saisieMode: vine.enum(['T', 'X', 'W'] as const).optional(),
    slug: vine
      .string()
      .trim()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .optional(),
  })
)

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

export const updateServiceValidator = vine.compile(
  vine.object({
    status: vine.enum(['active', 'archived'] as const).optional(),
    // .nullable() en plus de .optional() : null retire le slug existant
    // (service qui ne doit plus être exposé publiquement), undefined
    // signifie "ne pas toucher au slug".
    slug: vine
      .string()
      .trim()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .nullable()
      .optional(),
    // Les trois horaires se posent ensemble (voir update() du contrôleur)
    // — null retire l'horaire hebdo existant (service qui redevient
    // "toujours ouvert"), undefined signifie "ne pas y toucher".
    openingDays: vine.array(vine.number().min(1).max(7)).nullable().optional(),
    openingStartTime: vine.string().trim().regex(TIME_REGEX).nullable().optional(),
    openingEndTime: vine.string().trim().regex(TIME_REGEX).nullable().optional(),
    // Message affiché aux usagers quand le service est fermé manuellement
    // — null retire le message personnalisé (retour au texte générique),
    // undefined signifie "ne pas y toucher".
    closedMessage: vine.string().trim().minLength(1).maxLength(300).nullable().optional(),
  })
)

export const createServiceClosureValidator = vine.compile(
  vine.object({
    label: vine.string().trim().minLength(1).maxLength(120),
    startDate: vine.date(),
    endDate: vine.date(),
  })
)
