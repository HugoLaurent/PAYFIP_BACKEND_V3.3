import { SignJWT, importJWK } from 'jose'
import type { DateTime } from 'luxon'
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

export interface ServiceClosurePeriod {
  startDate: string
  endDate: string
}

export interface ServiceAvailability {
  status: string
  name: string
  orgName: string | null
  hasLogo: boolean
  isOpen: boolean
  reopensAt: string | null
  closedReason: string | null
  // Jours de la semaine ouverts à la visite (1=lundi...7=dimanche), null
  // = pas de restriction. N'affecte jamais `isOpen` (voir
  // service_availability_service.ts côté svc-auth) — sert uniquement à
  // valider la date de visite choisie, voir isVisitDateOpen ci-dessous.
  openingDays: number[] | null
  // Toutes les périodes de fermeture ponctuelles (passées, en cours,
  // futures) — `isOpen` ne reflète que celle EN COURS ; une période future
  // doit quand même interdire de choisir une date de visite qui tombe
  // dedans, même si on peut encore acheter aujourd'hui.
  closures: ServiceClosurePeriod[]
}

export function isVisitDateOpen(openingDays: number[] | null, visitDate: DateTime): boolean {
  if (!openingDays) return true
  return openingDays.includes(visitDate.weekday)
}

export function isVisitDateInClosure(closures: ServiceClosurePeriod[], visitDate: DateTime): boolean {
  const iso = visitDate.toISODate()
  return closures.some((c) => iso! >= c.startDate && iso! <= c.endDate)
}

/**
 * Statut + disponibilité à jour d'un service — revérifiés auprès de
 * svc-auth juste avant d'accepter une vente (agent ou en ligne), car le
 * JWT client d'un agent peut porter des informations vieilles de jusqu'à
 * 20 min : le front peut avoir déjà masqué le bouton de vente (statut,
 * horaires, période de fermeture) sans que ça empêche un appel API
 * direct sur un service indisponible entre temps. `isOpen` combine à la
 * fois le statut actif/archivé ET les horaires/fermetures éventuels —
 * svc-auth reste la seule source de vérité sur "ouvert maintenant".
 */
export async function fetchServiceStatus(
  orgId: number,
  serviceId: number
): Promise<ServiceAvailability | null> {
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

  const { data } = (await response.json()) as { data: ServiceAvailability }
  return data
}

/**
 * Logo du service (PNG), pour l'identité visuelle du billet PDF. Route
 * publique côté svc-auth (`GET /services/:id/logo`, sans jeton — c'est un
 * <img src> direct pour le front) : pas besoin de signer un JWT interne
 * ici. `null` si le service n'a pas de logo ou que l'appel échoue —
 * dégrade vers les initiales, jamais une erreur de génération du PDF.
 */
export async function fetchServiceLogo(serviceId: number): Promise<Buffer | null> {
  try {
    const response = await fetchWithTimeout(`${env.get('SVC_AUTH_BASE_URL')}/services/${serviceId}/logo`)
    if (!response.ok) return null
    return Buffer.from(await response.arrayBuffer())
  } catch {
    return null
  }
}
