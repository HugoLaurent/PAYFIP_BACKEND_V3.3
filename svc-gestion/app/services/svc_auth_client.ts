import env from '#start/env'
import { mintGestionJwt } from '#services/internal_jwt_service'
import { fetchWithTimeout } from '#services/fetch_with_timeout'

export interface PayfipAccountLookup {
  numcli: string
  saisieMode: 'T' | 'X' | 'W'
  status: 'draft' | 'active' | 'archived'
}

export async function findPayfipAccount(
  orgId: string,
  serviceId: number
): Promise<PayfipAccountLookup | null> {
  const token = await mintGestionJwt({ orgId, scope: 'gestion', aud: 'svc-auth' })

  const url = new URL(`${env.get('SVC_AUTH_BASE_URL')}/services/${serviceId}/payfip-account`)
  url.searchParams.set('orgId', orgId)

  const response = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } })

  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error(`svc-auth a répondu ${response.status} sur ${url.pathname}`)
  }

  const { data } = (await response.json()) as { data: PayfipAccountLookup }
  return data
}
