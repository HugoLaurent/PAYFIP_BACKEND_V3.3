import { SignJWT, importJWK } from 'jose'
import env from '#start/env'
import { fetchWithTimeout } from '#services/fetch_with_timeout'

function decodeJwk(base64: string) {
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'))
}

const privateKeyPromise = importJWK(decodeJwk(env.get('BILLETTERIE_JWT_PRIVATE_KEY')), 'EdDSA')

export interface ResolvedService {
  orgId: number
  serviceId: number
  status: string
}

/**
 * Résout à quel organisme/service appartient un numcli — utilisé lors
 * d'un dépôt AREGIE, où chaque ligne ne porte que le numcli, jamais
 * l'organisme directement. `orgId: '0'` est un jeton neutre : cet appel
 * n'a pas encore d'organisme connu, c'est justement ce qu'il sert à
 * découvrir.
 */
export async function resolveByNumcli(numcli: string): Promise<ResolvedService | null> {
  const privateKey = await privateKeyPromise
  const token = await new SignJWT({ orgId: '0', scope: 'billetterie' })
    .setProtectedHeader({ alg: 'EdDSA' })
    .setIssuedAt()
    .setExpirationTime('2m')
    .setAudience('svc-auth')
    .sign(privateKey)

  const response = await fetchWithTimeout(
    `${env.get('SVC_AUTH_BASE_URL')}/services/by-numcli/${encodeURIComponent(numcli)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!response.ok) return null

  const { data } = (await response.json()) as { data: ResolvedService }
  return data
}

/**
 * Statut à jour d'un service (active/draft/archived) — revérifié auprès
 * de svc-auth juste avant d'accepter une vente (agent ou en ligne), car
 * le JWT client d'un agent peut porter des informations vieilles de
 * jusqu'à 20 min : le front peut avoir déjà masqué le bouton de vente
 * sans que ça empêche un appel API direct sur un service fermé entre
 * temps.
 */
export async function fetchServiceStatus(orgId: number, serviceId: number): Promise<string | null> {
  const privateKey = await privateKeyPromise
  const token = await new SignJWT({ orgId: String(orgId), scope: 'billetterie' })
    .setProtectedHeader({ alg: 'EdDSA' })
    .setIssuedAt()
    .setExpirationTime('2m')
    .setAudience('svc-auth')
    .sign(privateKey)

  const url = new URL(`${env.get('SVC_AUTH_BASE_URL')}/services/${serviceId}/status`)
  url.searchParams.set('orgId', String(orgId))

  const response = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } })

  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`svc-auth a répondu ${response.status} sur ${url.pathname}`)
  }

  const { data } = (await response.json()) as { data: { status: string } }
  return data.status
}
