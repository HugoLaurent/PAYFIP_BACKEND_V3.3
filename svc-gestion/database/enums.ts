
export const SOURCE_SERVICES = ['billetterie', 'factures', 'inscription'] as const

export const PAYMENT_REQUEST_STATUSES = [
  'draft',
  'awaiting_payment',
  'paid',
  'failed',
  'cancelled',
  'expired',
] as const

export const RESOLUTION_TRIGGERS = ['urlnotif', 'urlredirect'] as const

export const WEBHOOK_EVENT_TYPES = ['paiement.valide', 'paiement.echec'] as const
export const WEBHOOK_DELIVERY_STATUSES = ['pending', 'delivered', 'failed'] as const
