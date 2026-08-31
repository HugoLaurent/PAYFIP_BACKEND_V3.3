import { SignJWT, importJWK } from 'jose'
import env from '#start/env'
import { fetchWithTimeout } from '#services/fetch_with_timeout'

function decodeJwk(base64: string) {
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'))
}

const privateKeyPromise = importJWK(decodeJwk(env.get('INSCRIPTION_JWT_PRIVATE_KEY')), 'EdDSA')

export interface ServiceAvailability {
  status: string
  name: string
  slug: string | null
  orgName: string | null
  hasLogo: boolean
  isOpen: boolean
  reopensAt: string | null
  closedReason: string | null
}

/**
 * Statut à jour d'un service — revérifié auprès de svc-auth juste avant
 * d'accepter une inscription (le JWT client d'un agent, ou la page
 * catalogue citoyenne, peut être vieux de plusieurs minutes). Version
 * allégée de l'équivalent svc-billetterie : pas de logique de
 * créneaux/horaires de visite ici, une inscription n'a pas de "date de
 * visite" à valider contre des horaires d'ouverture.
 */
export async function fetchServiceStatus(
  orgId: number,
  serviceId: number
): Promise<ServiceAvailability | null> {
  const privateKey = await privateKeyPromise
  const token = await new SignJWT({ orgId: String(orgId), scope: 'inscription' })
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
 * Emails des agents/admins à prévenir d'une inscription en attente de
 * vérification (voir registration_mail_service.ts#notifyAgentsOfPendingReview).
 * Dégrade vers une liste vide si svc-auth est injoignable — jamais une
 * erreur qui ferait échouer la création de l'inscription elle-même, cette
 * notification reste best-effort.
 */
export async function fetchNotificationRecipients(orgId: number, serviceId: number): Promise<string[]> {
  const privateKey = await privateKeyPromise
  const token = await new SignJWT({ orgId: String(orgId), scope: 'inscription' })
    .setProtectedHeader({ alg: 'EdDSA' })
    .setIssuedAt()
    .setExpirationTime('2m')
    .setAudience('svc-auth')
    .sign(privateKey)

  const url = new URL(`${env.get('SVC_AUTH_BASE_URL')}/services/${serviceId}/notification-recipients`)
  url.searchParams.set('orgId', String(orgId))

  try {
    const response = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!response.ok) return []
    const { data } = (await response.json()) as { data: { emails: string[] } }
    return data.emails
  } catch {
    return []
  }
}

/**
 * Logo du service, pour l'identité visuelle des emails et de l'attestation
 * PDF. Route publique côté svc-auth (`GET /services/:id/logo`, sans
 * jeton) : pas besoin de signer un JWT interne ici. `null` si le service
 * n'a pas de logo ou que l'appel échoue — dégrade vers les initiales,
 * jamais une erreur de génération.
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
