
export const TARIFF_STATUSES = ['active', 'archived'] as const

export const ORDER_STATUSES = ['draft', 'awaiting_payment', 'confirmed', 'cancelled'] as const
export const PAYMENT_METHODS = ['payfip', 'cash', 'card', 'check', 'other', 'free'] as const

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
