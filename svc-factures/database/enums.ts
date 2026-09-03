
export const INVOICE_STATUSES = ['draft', 'awaiting_payment', 'confirmed', 'cancelled'] as const

// Vocabulaire calqué sur payment_webhook.ts (status: 'paid'|'failed'),
// pas sur INVOICE_STATUSES : c'est ce que svc-gestion nous dit
// réellement. 'awaiting_payment' est l'état initial, 'expired' posé par
// le balayage périodique (voir payment_attempt_expiry_service.ts) quand
// l'idOp PayFiP (15 min) est dépassé sans jamais avoir reçu de webhook.
export const PAYMENT_ATTEMPT_STATUSES = ['awaiting_payment', 'paid', 'failed', 'expired'] as const
