import env from '#start/env'
import logger from '@adonisjs/core/services/logger'

// Alerte best-effort (Teams) pour les échecs opérationnels qu'un humain doit
// voir — jamais bloquant : une alerte qui échoue ne doit pas faire échouer
// l'opération qu'elle rapporte.
export async function notifyOpsAlert(title: string, text: string): Promise<void> {
  const url = env.get('OPS_ALERT_WEBHOOK_URL')
  if (!url) return

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, text }),
    })
  } catch (error) {
    logger.warn({ error }, 'ops_alert: échec envoi alerte')
  }
}
