import { SignJWT, importJWK } from 'jose'
import env from '#start/env'
import { fetchWithTimeout } from '#services/fetch_with_timeout'

function decodeJwk(base64: string) {
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'))
}

const privateKeyPromise = importJWK(decodeJwk(env.get('MAIL_JWT_PRIVATE_KEY')), 'EdDSA')

/**
 * Clé API AREGIE Mail propre à un service — stockée chiffrée côté svc-auth
 * (table services, voir tenant_credentials_service.ts), jamais dupliquée
 * ici. `null` si le service n'a pas de clé configurée, comme si svc-auth
 * était injoignable : resolveApiKey retombe alors sur la clé par défaut.
 */
export async function fetchServiceAregieMailKey(serviceId: string): Promise<string | null> {
  const privateKey = await privateKeyPromise
  const token = await new SignJWT({ orgId: '0', scope: 'mail' })
    .setProtectedHeader({ alg: 'EdDSA', kid: 'svc-mail' })
    .setIssuedAt()
    .setExpirationTime('2m')
    .setAudience('svc-auth')
    .sign(privateKey)

  const response = await fetchWithTimeout(
    `${env.get('SVC_AUTH_BASE_URL')}/internal/services/${serviceId}/aregie-mail-key`,
    { headers: { Authorization: `Bearer ${token}` } }
  ).catch(() => null)

  if (!response || !response.ok) return null

  const { data } = (await response.json()) as { data: { apiKey: string | null } }
  return data.apiKey
}
