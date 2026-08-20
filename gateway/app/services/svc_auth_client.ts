import env from '#start/env'
import { mintInternalJwt } from '#services/internal_jwt_service'
import { fetchWithTimeout } from '#services/fetch_with_timeout'

export interface AgentPermissions {
  canSell: boolean
  canScan: boolean
  canManageTariffs: boolean
  canViewHistory: boolean
  canToggleService: boolean
}

export interface LoginResult {
  userId: number
  orgId: number
  orgName: string | null
  email: string
  firstName: string | null
  lastName: string | null
  role: 'admin' | 'agent'
  services: { id: number; name: string; serviceType: string; permissions: AgentPermissions }[]
  passwordChangeRequired: boolean
}

export async function loginWithCredentials(
  email: string,
  password: string
): Promise<LoginResult | null> {
  const response = await fetchWithTimeout(`${env.get('SVC_AUTH_BASE_URL')}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) return null

  const { data } = (await response.json()) as { data: LoginResult }
  return data
}

export interface ProfileResult {
  id: number
  orgId: number
  orgName: string | null
  email: string
  firstName: string | null
  lastName: string | null
  role: 'admin' | 'agent'
  services: { id: number; name: string; serviceType: string; permissions: AgentPermissions }[]
  passwordChangeRequired: boolean
}

/**
 * Relit le profil courant (pair-à-pair, JWT interne signé par le
 * Gateway) — utilisé pour le rafraîchissement du JWT client, afin que
 * des droits révoqués/modifiés depuis le login s'appliquent au prochain
 * rafraîchissement plutôt que jamais avant la prochaine reconnexion.
 */
export async function fetchCurrentProfile(
  userId: number,
  orgId: number
): Promise<ProfileResult | null> {
  const token = await mintInternalJwt({
    orgId: String(orgId),
    scope: 'auth',
    sub: String(userId),
    aud: 'svc-auth',
  })

  const response = await fetchWithTimeout(`${env.get('SVC_AUTH_BASE_URL')}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) return null

  const { data } = (await response.json()) as { data: ProfileResult }
  return data
}
