// 'fake' = MAIL_MODE=fake (démo/dev) : pas vraiment envoyé, juste conservé
// pour la page de prévisualisation staff.
export const EMAIL_DELIVERY_STATUSES = ['pending', 'sent', 'failed', 'fake'] as const
export type EmailDeliveryStatus = (typeof EMAIL_DELIVERY_STATUSES)[number]
