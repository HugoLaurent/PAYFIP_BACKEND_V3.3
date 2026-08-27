
export const EVENT_TYPES = ['formation', 'evenement'] as const

export const EVENT_STATUSES = ['draft', 'published', 'closed', 'archived'] as const

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

export const FAILED_REGISTRATION_MAIL_KINDS = [
  'confirmation',
  'payment_request',
  'rejection',
  'waitlist_offer',
] as const

export const FORM_FIELD_TYPES = [
  'short_text',
  'long_text',
  'date',
  'number',
  'choice',
  'checkbox',
] as const
