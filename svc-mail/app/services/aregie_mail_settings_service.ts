import encryption from '@adonisjs/core/services/encryption'
import AregieMailSetting from '#models/aregie_mail_setting'

// Ligne unique — pas de multi-tenant ici, une seule clé AREGIE Mail pour
// toute la plateforme PayFiP.
const SETTINGS_ROW_ID = 1

async function getRow(): Promise<AregieMailSetting | null> {
  return AregieMailSetting.find(SETTINGS_ROW_ID)
}

export interface AregieMailApiKeyStatus {
  configured: boolean
  last4: string | null
  updatedAt: string | null
}

export async function getApiKeyStatus(): Promise<AregieMailApiKeyStatus> {
  const row = await getRow()
  if (!row?.apiKeyEncrypted) {
    return { configured: false, last4: null, updatedAt: null }
  }

  const apiKey = encryption.decrypt<string>(row.apiKeyEncrypted)
  return {
    configured: true,
    last4: apiKey ? apiKey.slice(-4) : null,
    updatedAt: row.updatedAt.toISO(),
  }
}

// Chiffré avec APP_KEY (propre à svc-mail) avant stockage — remplace la
// protection que Vault apportait auparavant à ce secret.
export async function setApiKey(apiKey: string): Promise<void> {
  const row = (await getRow()) ?? new AregieMailSetting()
  row.id = SETTINGS_ROW_ID
  row.apiKeyEncrypted = encryption.encrypt(apiKey)
  await row.save()
}

export async function getApiKey(): Promise<string | null> {
  const row = await getRow()
  if (!row?.apiKeyEncrypted) return null
  return encryption.decrypt<string>(row.apiKeyEncrypted)
}
