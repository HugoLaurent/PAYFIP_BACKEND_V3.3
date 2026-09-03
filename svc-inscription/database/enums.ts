
export const EVENT_TYPES = ['formation', 'evenement'] as const

// 'cancelled' n'est jamais posé par PATCH /events/:id (voir
// events_controller.ts#update) — uniquement via POST /events/:id/cancel,
// qui bascule aussi les inscriptions actives et envoie l'email
// d'annulation. Distinct de 'archived' : un évènement archivé n'a jamais eu
// personne à prévenir (0 inscription, sinon la suppression le refuse).
export const EVENT_STATUSES = ['draft', 'published', 'closed', 'archived', 'cancelled'] as const

// L'ordre n'a pas de signification (pas de machine à états linéaire) —
// voir registrations_controller.ts / capacity_service.ts / waitlist_service.ts
// pour les transitions réellement autorisées entre ces statuts.
export const REGISTRATION_STATUSES = [
  'waitlisted',
  'awaiting_review',
  'rejected',
  'awaiting_payment',
  'confirmed',
  'cancelled',
  'expired',
] as const

export const PAYMENT_METHODS = ['payfip', 'free'] as const

// Vocabulaire calqué sur payment_webhook.ts (status: 'paid'|'failed'),
// pas sur REGISTRATION_STATUSES : c'est ce que svc-gestion nous dit
// réellement. 'awaiting_payment' est l'état initial, 'expired' posé par
// le balayage périodique (payment_attempt_expiry_service.ts) quand
// l'idOp PayFiP (15 min) est dépassé sans jamais avoir reçu de webhook.
export const PAYMENT_ATTEMPT_STATUSES = ['awaiting_payment', 'paid', 'failed', 'expired'] as const

export const FAILED_REGISTRATION_MAIL_KINDS = [
  'confirmation',
  'payment_request',
  'rejection',
  'waitlist_offer',
  'event_cancelled',
] as const

export const FORM_FIELD_TYPES = [
  'short_text',
  'long_text',
  'date',
  'number',
  'choice',
  'checkbox',
] as const
