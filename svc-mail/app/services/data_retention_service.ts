import { DateTime } from 'luxon'
import EmailDelivery from '#models/email_delivery'

// Le journal des envois (email du destinataire + nom/référence dans `data`)
// ne sert qu'aux relances (24 h maximum, voir MAX_RETRY_AGE_HOURS) et à
// l'aperçu staff : on ne le garde pas au-delà. Les codes de vérification
// (template otp_code, code en clair dans `data`) partent beaucoup plus vite.
// À répercuter dans la politique de confidentialité (payfip-front,
// LegalNoticePage) si ces durées changent.
export const EMAIL_LOG_RETENTION_DAYS = 30
export const OTP_EMAIL_RETENTION_HOURS = 24

function affectedRows(deleted: unknown): number {
  return Array.isArray(deleted) ? Number(deleted[0] ?? 0) : Number(deleted ?? 0)
}

export async function purgeOldEmailDeliveries(): Promise<number> {
  const otpCutoff = DateTime.now().minus({ hours: OTP_EMAIL_RETENTION_HOURS }).toSQL()!
  const logCutoff = DateTime.now().minus({ days: EMAIL_LOG_RETENTION_DAYS }).toSQL()!

  const otpDeleted = affectedRows(
    await EmailDelivery.query().where('template', 'otp_code').where('createdAt', '<', otpCutoff).delete()
  )
  const logDeleted = affectedRows(await EmailDelivery.query().where('createdAt', '<', logCutoff).delete())

  return otpDeleted + logDeleted
}
