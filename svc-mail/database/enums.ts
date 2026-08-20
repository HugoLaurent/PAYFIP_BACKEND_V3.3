export const EMAIL_DELIVERY_STATUSES = ['pending', 'sent', 'failed'] as const
export type EmailDeliveryStatus = (typeof EMAIL_DELIVERY_STATUSES)[number]
