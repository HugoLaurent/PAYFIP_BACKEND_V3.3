
export const TARIFF_STATUSES = ['active', 'archived'] as const

export const ORDER_STATUSES = ['draft', 'awaiting_payment', 'confirmed', 'cancelled'] as const
export const PAYMENT_METHODS = ['payfip', 'cash', 'card', 'check', 'other', 'free'] as const

// Vocabulaire volontairement calqué sur payment_webhook.ts (status:
// 'paid'|'failed') plutôt que sur ORDER_STATUSES : c'est ce que
// svc-gestion nous dit réellement, pas la traduction qu'on en fait pour
// order.status. 'awaiting_payment' est l'état initial, avant tout retour
// PayFiP.
export const PAYMENT_ATTEMPT_STATUSES = ['awaiting_payment', 'paid', 'failed', 'expired'] as const

export const TICKET_STATUSES = ['issued', 'consumed', 'refunded', 'cancelled', 'expired'] as const

export const SCAN_RESULTS = [
  'valid',
  'already_consumed',
  'invalid_date',
  'not_found',
  'invalid_signature',
  'other',
  'reset',
] as const
