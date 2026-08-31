import vine from '@vinejs/vine'
import { REGISTRATION_STATUSES } from '#database/enums'

// La validation détaillée de `formResponses` (champs obligatoires
// présents, valeur `choice` dans `options`...) dépend du `formSchema` de
// l'évènement concerné, connu seulement une fois l'Event chargé — elle est
// donc faite à la main dans le contrôleur (voir
// validateFormResponsesAgainstSchema), pas ici. On accepte ici n'importe
// quel objet à clés dynamiques.
export const createRegistrationValidator = vine.compile(
  vine.object({
    eventId: vine.number().positive(),
    email: vine.string().trim().email(),
    firstName: vine.string().trim().minLength(1),
    lastName: vine.string().trim().minLength(1),
    quantity: vine.number().positive().optional(),
    formResponses: vine.record(vine.any()).optional(),
    frontRedirectUrl: vine.string().trim().url({ require_tld: false }),
  })
)

export const listRegistrationsValidator = vine.compile(
  vine.object({
    status: vine.enum(REGISTRATION_STATUSES).optional(),
    q: vine.string().trim().minLength(1).optional(),
    page: vine.number().positive().optional(),
    perPage: vine.number().positive().max(100).optional(),
  })
)

export const reviewRegistrationValidator = vine.compile(
  vine.object({
    // 'request_more_documents' : les documents déjà déposés restent
    // valables, on demande juste un complément (voir
    // registrations_controller.ts#review) — distinct d'un vrai 'reject'
    // uniquement par ce qui arrive aux documents existants au redépôt.
    // 'revert' : annule une décision prise par erreur (clic sur "Valider"
    // par mégarde), remet en 'awaiting_review' — seulement quand aucun
    // encaissement réel n'a eu lieu, voir #review.
    decision: vine.enum(['approve', 'reject', 'request_more_documents', 'revert'] as const),
    rejectionReason: vine
      .string()
      .trim()
      .minLength(1)
      .optional()
      .requiredWhen('decision', 'in', ['reject', 'request_more_documents']),
  })
)

export const retryRegistrationPaymentValidator = vine.compile(
  vine.object({
    frontRedirectUrl: vine.string().trim().url({ require_tld: false }),
  })
)

export const payRegistrationValidator = vine.compile(
  vine.object({
    frontRedirectUrl: vine.string().trim().url({ require_tld: false }),
  })
)

export const cancelRegistrationValidator = vine.compile(vine.object({}))
