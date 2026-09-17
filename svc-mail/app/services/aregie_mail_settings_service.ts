import encryption from '@adonisjs/core/services/encryption'
import AregieMailSetting from '#models/aregie_mail_setting'
import { fetchServiceAregieMailKey } from '#services/svc_auth_client'

// Ligne unique — la clé "par défaut", utilisée pour les emails sans
// service précis (OTP). C'est la clé de PayFiP/AREGIE elle-même, distincte
// des clés par service (stockées côté svc-auth, table services — un
// organisme peut avoir plusieurs services avec des boîtes d'envoi
// différentes, voir svc-auth/app/controllers/services_controller.ts).
const DEFAULT_ROW_ID = 1

export interface AregieMailApiKeyStatus {
  configured: boolean
  last4: string | null
  updatedAt: string | null
}

export async function getDefaultApiKeyStatus(): Promise<AregieMailApiKeyStatus> {
  const row = await AregieMailSetting.find(DEFAULT_ROW_ID)
  if (!row?.apiKeyEncrypted) return { configured: false, last4: null, updatedAt: null }

  const apiKey = encryption.decrypt<string>(row.apiKeyEncrypted)
  return {
    configured: Boolean(apiKey),
    last4: apiKey ? apiKey.slice(-4) : null,
    updatedAt: row.updatedAt.toISO(),
  }
}

// Chiffré avec APP_KEY (propre à svc-mail) avant stockage — remplace la
// protection que Vault apportait auparavant à ce secret.
export async function setDefaultApiKey(apiKey: string): Promise<void> {
  const row = (await AregieMailSetting.find(DEFAULT_ROW_ID)) ?? new AregieMailSetting()
  row.id = DEFAULT_ROW_ID
  row.apiKeyEncrypted = encryption.encrypt(apiKey)
  await row.save()
}

async function getDefaultApiKey(): Promise<string | null> {
  const row = await AregieMailSetting.find(DEFAULT_ROW_ID)
  if (!row?.apiKeyEncrypted) return null
  return encryption.decrypt<string>(row.apiKeyEncrypted)
}

/**
 * Résout la clé à utiliser pour un envoi : celle du service s'il en a une
 * configurée côté svc-auth, sinon la clé par défaut (cas des emails sans
 * service, ex. OTP, ou d'un service pas encore configuré).
 */
export async function resolveApiKey(serviceId: string | null): Promise<string | null> {
  if (serviceId) {
    const serviceKey = await fetchServiceAregieMailKey(serviceId)
    if (serviceKey) return serviceKey
  }
  return getDefaultApiKey()
}
