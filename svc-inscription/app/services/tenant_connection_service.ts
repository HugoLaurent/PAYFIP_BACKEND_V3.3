import { AsyncLocalStorage } from 'node:async_hooks'
import db from '@adonisjs/lucid/services/db'
import {
  getTenantConfig,
  listTenantConfigsForOrg,
  listAllTenantConfigs,
} from '#services/tenant_registry_client'

// Porte le nom de connexion actif à travers un appel — lu par
// TenantBaseModel pour passer { connection: name } explicitement à chaque
// requête Lucid, jamais en mutant la connexion par défaut globale (qui
// serait partagée entre requêtes concurrentes de tenants différents).
export const tenantConnectionStorage = new AsyncLocalStorage<string>()

// Compteur de requêtes en vol par connexion — lu par le futur job
// d'éviction (hors phase 1) pour ne fermer un pool que si ce compteur est
// à zéro, vérifié de façon synchrone juste avant l'appel à close().
const inFlightCounts = new Map<string, number>()

export function connectionNameFor(serviceId: number): string {
  return `tenant_inscription_${serviceId}`
}

export function currentInFlightCount(name: string): number {
  return inFlightCounts.get(name) ?? 0
}

async function ensure(serviceId: number): Promise<string> {
  const name = connectionNameFor(serviceId)
  if (!db.manager.has(name)) {
    const config = await getTenantConfig(serviceId)
    if (!config) {
      throw new Error(`unknown_tenant_service_id:${serviceId}`)
    }
    db.manager.add(name, {
      client: 'pg',
      connection: {
        host: config.dbHost,
        port: config.dbPort,
        user: config.dbUser,
        password: config.dbPassword,
        database: config.dbName,
      },
      migrations: { naturalSort: true, paths: ['database/migrations'] },
    })
  }
  return name
}

// Message exact levé par pg-pool quand un pool a été fermé (close()) mais
// reste enregistré côté Lucid — has() resterait vrai, donc ensure() seul
// ne suffit pas à s'en remettre.
function isPoolClosedError(err: unknown): boolean {
  return err instanceof Error && err.message.includes('Cannot use a pool after calling end')
}

/**
 * Exécute `fn` dans le contexte du tenant `serviceId`. Filet de sécurité :
 * si le pool a été fermé entre le moment où le caller a décidé d'appeler
 * cette fonction et l'exécution effective de la requête (course avec une
 * éviction d'inactivité), on force un ré-enregistrement complet et on
 * retente une seule fois.
 */
export async function runOnTenant<T>(serviceId: number, fn: () => Promise<T>): Promise<T> {
  const name = await ensure(serviceId)
  inFlightCounts.set(name, (inFlightCounts.get(name) ?? 0) + 1)

  try {
    return await tenantConnectionStorage.run(name, async () => {
      try {
        return await fn()
      } catch (err) {
        if (!isPoolClosedError(err)) throw err
        await db.manager.release(name)
        await ensure(serviceId)
        return await fn()
      }
    })
  } finally {
    inFlightCounts.set(name, Math.max(0, (inFlightCounts.get(name) ?? 1) - 1))
  }
}

/**
 * Résout les connexions tenant de tous les services `inscription` d'un
 * organisme — fan-out borné, jamais l'annuaire entier. Utilisé pour
 * résoudre un accessToken (aucun serviceId connu du citoyen à ce stade).
 */
export async function ensureTenantConnectionsForOrg(orgId: number): Promise<number[]> {
  const configs = listTenantConfigsForOrg(orgId)
  await Promise.all(configs.map((config) => ensure(config.serviceId)))
  return configs.map((config) => config.serviceId)
}

/**
 * Enregistre les connexions d'une liste explicite de services (ex.
 * l'agent.serviceIds d'un JWT) — cette liste est TOUS TYPES DE SERVICE
 * CONFONDUS (un agent peut avoir accès à des services billetterie ET
 * inscription à la fois) : un id qui n'est pas un service inscription
 * est une situation normale, pas une erreur — on l'ignore silencieusement
 * plutôt que de laisser ensure() lever unknown_tenant_service_id.
 */
export async function ensureTenantConnections(serviceIds: number[]): Promise<number[]> {
  const configs = await Promise.all(serviceIds.map((id) => getTenantConfig(id)))
  const known = serviceIds.filter((_, i) => configs[i] !== null)
  await Promise.all(known.map((id) => ensure(id)))
  return known
}

/**
 * Exécute `fn` sur chaque service inscription connu, tous organismes
 * confondus — réservé aux jobs sans organisme à filtrer (ex. le rejeu des
 * emails en échec). Concurrence plafonnée.
 */
export async function runOnAllTenants<T>(
  fn: (serviceId: number) => Promise<T>,
  concurrency = 10
): Promise<T[]> {
  const serviceIds = listAllTenantConfigs().map((config) => config.serviceId)
  const results: T[] = new Array(serviceIds.length)
  let cursor = 0

  async function worker() {
    while (cursor < serviceIds.length) {
      const index = cursor++
      results[index] = await runOnTenant(serviceIds[index], () => fn(serviceIds[index]))
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, serviceIds.length) }, () => worker())
  )
  return results
}
