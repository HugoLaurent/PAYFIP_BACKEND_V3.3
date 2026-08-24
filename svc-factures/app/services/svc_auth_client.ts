import env from '#start/env'
import { mintFacturesJwt } from '#services/internal_jwt_service'
import { fetchWithTimeout } from '#services/fetch_with_timeout'

export interface ResolvedService {
  orgId: number
  serviceId: number
  status: string
  name: string
}

/**
 * Résout à quel organisme/service appartient un numcli — utilisé lors
 * d'un dépôt AREGIE, où chaque ligne ne porte que le numcli, jamais
 * l'organisme directement. `orgId: '0'` est un jeton neutre : cet appel
 * n'a pas encore d'organisme connu, c'est justement ce qu'il sert à
 * découvrir.
 */
export async function resolveByNumcli(numcli: string): Promise<ResolvedService | null> {
  const token = await mintFacturesJwt({ orgId: '0', scope: 'factures', aud: 'svc-auth' })

  const response = await fetchWithTimeout(
    `${env.get('SVC_AUTH_BASE_URL')}/services/by-numcli/${encodeURIComponent(numcli)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!response.ok) return null

  const { data } = (await response.json()) as { data: ResolvedService }
  return data
}

export async function fetchServiceName(orgId: string, serviceId: number): Promise<string | null> {
  try {
    const token = await mintFacturesJwt({ orgId, scope: 'factures', aud: 'svc-auth' })

    const url = new URL(`${env.get('SVC_AUTH_BASE_URL')}/services/${serviceId}/label`)
    url.searchParams.set('orgId', orgId)

    const response = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!response.ok) return null

    const { data } = (await response.json()) as { data: { name: string } }
    return data.name
  } catch {
    return null
  }
}

export interface ServiceIdentity {
  name: string
  orgName: string | null
  hasLogo: boolean
}

/**
 * Identité visuelle (nom, organisme, logo) pour l'email de confirmation
 * de paiement — même route que fetchServiceName, juste une lecture plus
 * complète de la réponse. `null` si le paiement n'est rattaché à aucun
 * service (serviceId nul) ou que svc-auth ne répond pas : l'email dégrade
 * alors vers un en-tête générique, jamais une erreur d'envoi.
 */
export async function fetchServiceIdentity(orgId: string, serviceId: number): Promise<ServiceIdentity | null> {
  try {
    const token = await mintFacturesJwt({ orgId, scope: 'factures', aud: 'svc-auth' })

    const url = new URL(`${env.get('SVC_AUTH_BASE_URL')}/services/${serviceId}/label`)
    url.searchParams.set('orgId', orgId)

    const response = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!response.ok) return null

    const { data } = (await response.json()) as { data: ServiceIdentity }
    return data
  } catch {
    return null
  }
}
