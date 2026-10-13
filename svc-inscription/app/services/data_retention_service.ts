import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import OtpCode from '#models/otp_code'
import { runOnAllTenants, tenantConnectionStorage } from '#services/tenant_connection_service'

// Durées de conservation annoncées dans la politique de confidentialité (voir
// payfip-front, LegalNoticePage). Toute modification ici doit être répercutée
// dans ce texte, et inversement.
export const REGISTRATION_RETENTION_MONTHS = 12
export const OTP_RETENTION_HOURS = 24

/**
 * Supprime les inscriptions dont l'évènement est terminé depuis plus de
 * REGISTRATION_RETENTION_MONTHS mois (à défaut de date d'évènement : créées
 * depuis plus longtemps que ça). Les tentatives de paiement, mails en échec
 * et notifications liées partent avec elles (ON DELETE CASCADE). Les
 * évènements eux-mêmes ne contiennent aucune donnée personnelle : conservés.
 * Retourne le nombre d'inscriptions supprimées, toutes bases de service
 * confondues.
 */
export async function purgeExpiredRegistrations(): Promise<number> {
  const counts = await runOnAllTenants(async () => {
    const connection = db.connection(tenantConnectionStorage.getStore()!)
    const result = await connection.rawQuery(
      `DELETE FROM registrations r USING events e
       WHERE r.event_id = e.id
         AND COALESCE(e.event_date::timestamp, r.created_at) < now() - (? * interval '1 month')`,
      [REGISTRATION_RETENTION_MONTHS]
    )
    return Number(result.rowCount ?? 0)
  })
  return counts.reduce((total, count) => total + count, 0)
}

/**
 * Supprime les codes de vérification (adresse email + code) expirés depuis
 * plus de OTP_RETENTION_HOURS heures. Un code n'est valable que quelques
 * minutes : la marge d'une journée ne sert qu'à ne jamais couper une
 * vérification encore en cours.
 */
export async function purgeExpiredOtpCodes(): Promise<number> {
  const cutoff = DateTime.now().minus({ hours: OTP_RETENTION_HOURS }).toSQL()!
  const deleted = (await OtpCode.query().where('expiresAt', '<', cutoff).delete()) as unknown
  return Array.isArray(deleted) ? Number(deleted[0] ?? 0) : Number(deleted ?? 0)
}
