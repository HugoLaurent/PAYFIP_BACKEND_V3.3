import vine from '@vinejs/vine'
import { EVENT_TYPES, EVENT_STATUSES, FORM_FIELD_TYPES } from '#database/enums'

const formFieldValidator = vine.object({
  key: vine.string().trim().minLength(1),
  label: vine.string().trim().minLength(1),
  type: vine.enum(FORM_FIELD_TYPES),
  required: vine.boolean(),
  // Uniquement pertinent pour type === 'choice' — pas de contrainte croisée
  // ici (vine ne fait pas facilement de validation conditionnelle sur un
  // élément de tableau) ; côté agent une incohérence est sans conséquence,
  // seul compte le contrôle des `formResponses` soumis par le citoyen.
  options: vine.array(vine.string().trim().minLength(1)).optional(),
})

// Une pièce nommée par exigence (voir Event.DocumentRequirement) — plafonné
// à 5 comme l'ancien MAX_DOCUMENTS côté registrations_controller.ts, pas de
// raison de permettre davantage de slots de dépôt distincts.
const documentRequirementValidator = vine.object({
  key: vine.string().trim().minLength(1),
  label: vine.string().trim().minLength(1),
  instructions: vine.string().trim().optional(),
  required: vine.boolean(),
})

const timeOfDay = vine.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const slugField = vine
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .maxLength(120)

export const createEventValidator = vine.compile(
  vine.object({
    type: vine.enum(EVENT_TYPES),
    title: vine.string().trim().minLength(1),
    // Laissé vide = généré depuis `title` (voir events_controller.ts).
    slug: slugField.optional(),
    description: vine.string().trim().optional(),
    eventDate: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
    startTime: timeOfDay.optional(),
    endTime: timeOfDay.optional(),
    timeLabel: vine.string().trim().maxLength(60).optional(),
    location: vine.string().trim().maxLength(255).optional(),
    category: vine.string().trim().maxLength(60).optional(),
    registrationDeadline: vine
      .date({ formats: ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD'] })
      .optional(),
    priceCents: vine.number().min(0),
    documentRequirements: vine.array(documentRequirementValidator).maxLength(5).nullable().optional(),
    capacity: vine.number().positive().optional(),
    maxParticipantsPerRegistration: vine.number().positive().optional(),
    formSchema: vine.array(formFieldValidator).optional(),
    status: vine.enum(EVENT_STATUSES).optional(),
  })
)

export const updateEventValidator = vine.compile(
  vine.object({
    type: vine.enum(EVENT_TYPES).optional(),
    title: vine.string().trim().minLength(1).optional(),
    slug: slugField.optional(),
    // null retire la description existante, undefined = ne pas y toucher.
    description: vine.string().trim().nullable().optional(),
    eventDate: vine.date({ formats: ['YYYY-MM-DD'] }).nullable().optional(),
    startTime: timeOfDay.nullable().optional(),
    endTime: timeOfDay.nullable().optional(),
    timeLabel: vine.string().trim().maxLength(60).nullable().optional(),
    location: vine.string().trim().maxLength(255).nullable().optional(),
    category: vine.string().trim().maxLength(60).nullable().optional(),
    registrationDeadline: vine
      .date({ formats: ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD'] })
      .nullable()
      .optional(),
    priceCents: vine.number().min(0).optional(),
    documentRequirements: vine.array(documentRequirementValidator).maxLength(5).nullable().optional(),
    capacity: vine.number().positive().nullable().optional(),
    maxParticipantsPerRegistration: vine.number().positive().optional(),
    formSchema: vine.array(formFieldValidator).nullable().optional(),
    status: vine.enum(EVENT_STATUSES).optional(),
  })
)

export const listEventsAgentValidator = vine.compile(
  vine.object({
    serviceId: vine.number().positive(),
    page: vine.number().positive().optional(),
    perPage: vine.number().positive().max(100).optional(),
  })
)
