import env from '#start/env'
import { mintInscriptionJwt } from '#services/internal_jwt_service'
import { fetchWithTimeout } from '#services/fetch_with_timeout'

export interface TenantDbConfig {
  serviceId: number
  orgId: number
  serviceType: string
  dbHost: string
  dbPort: number
  dbName: string
  dbUser: string
  dbPassword: string
}

const APP_NAME = 'inscription'

let cache = new Map<number, TenantDbConfig>()
let refreshTimer: NodeJS.Timeout | null = null

async function fetchRegistry(): Promise<TenantDbConfig[]> {
  const token = await mintInscriptionJwt({ orgId: '0', scope: 'inscription', aud: 'svc-auth' })

  const response = await fetchWithTimeout(
    `${env.get('SVC_AUTH_BASE_URL')}/tenant-databases/${APP_NAME}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!response.ok) {
    throw new Error(`tenant_registry_fetch_failed: ${response.status}`)
  }

  const { data } = (await response.json()) as { data: TenantDbConfig[] }
  return data
}

/**
 * Recharge l'annuaire depuis svc-auth. Appelé au boot, sur l'intervalle de
 * rafraîchissement (serveur HTTP uniquement — voir start/tenant_registry.ts),
 * et explicitement par les commandes ace (tenant:migrate/tenant:provision)
 * qui ne tournent jamais assez longtemps pour bénéficier de l'intervalle.
 */
export async function refreshTenantRegistry(): Promise<void> {
  const rows = await fetchRegistry()
  cache = new Map(rows.map((row) => [row.serviceId, row]))
}

export function startTenantRegistryAutoRefresh(intervalMs = 60_000): void {
  if (refreshTimer) return
  refreshTimer = setInterval(() => {
    refreshTenantRegistry().catch(() => {
      // Le cache existant reste servi tel quel — une panne temporaire de
      // svc-auth ne doit jamais faire tomber les tenants déjà connus.
    })
  }, intervalMs)
  refreshTimer.unref()
}

/**
 * Résout la config d'un tenant. Recharge l'annuaire une seule fois si le
 * cache est encore vide (premier appel après boot, avant le premier tick
 * de l'intervalle) — ne recharge jamais juste parce qu'un serviceId est
 * absent du cache.
 */
export async function getTenantConfig(serviceId: number): Promise<TenantDbConfig | null> {
  if (cache.size === 0) {
    await refreshTenantRegistry()
  }
  return cache.get(serviceId) ?? null
}

export function listTenantConfigsForOrg(orgId: number): TenantDbConfig[] {
  return [...cache.values()].filter((config) => config.orgId === orgId)
}

export function listAllTenantConfigs(): TenantDbConfig[] {
  return [...cache.values()]
}

export interface RegisterTenantDatabaseInput {
  serviceId: number
  dbHost: string
  dbPort: number
  dbName: string
  dbUser: string
  dbPassword: string
}

export async function registerTenantDatabase(
  input: RegisterTenantDatabaseInput
): Promise<{ id: number; status: string }> {
  const token = await mintInscriptionJwt({ orgId: '0', scope: 'inscription', aud: 'svc-auth' })

  const response = await fetchWithTimeout(`${env.get('SVC_AUTH_BASE_URL')}/tenant-databases`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, appName: APP_NAME }),
  })

  if (!response.ok) {
    throw new Error(`tenant_registry_register_failed: ${response.status}`)
  }

  const { data } = (await response.json()) as { data: { id: number; status: string } }
  return data
}

export async function activateTenantDatabase(tenantDatabaseId: number): Promise<void> {
  const token = await mintInscriptionJwt({ orgId: '0', scope: 'inscription', aud: 'svc-auth' })

  const response = await fetchWithTimeout(
    `${env.get('SVC_AUTH_BASE_URL')}/tenant-databases/${tenantDatabaseId}/status`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    }
  )

  if (!response.ok) {
    throw new Error(`tenant_registry_activate_failed: ${response.status}`)
  }
}
