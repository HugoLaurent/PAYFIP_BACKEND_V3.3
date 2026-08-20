import { SignJWT, importJWK } from 'jose'
import env from '#start/env'

export interface AgentPermissions {
  canSell: boolean
  canScan: boolean
  canManageTariffs: boolean
  canViewHistory: boolean
  canToggleService: boolean
}

export interface InternalJwtClaims {
  orgId: string
  scope: string
  sub?: string
  role?: string
  servicePermissions?: Record<string, AgentPermissions>
  serviceIds?: number[]
  // Identité de l'appelant (agent/admin) — jamais utilisée pour du
  // contrôle d'accès (ça reste orgId/role/servicePermissions), juste
  // pour que svc-billetterie puisse figer "qui a vendu/scanné" au
  // moment de l'action, sans avoir à rappeler svc-auth à chaque lecture
  // de l'historique.
  agentEmail?: string | null
  agentFirstName?: string | null
  agentLastName?: string | null
  aud: string
}

export function buildServicePermissions(
  services: { id: number; permissions: AgentPermissions }[]
): Record<string, AgentPermissions> {
  return Object.fromEntries(services.map((s) => [String(s.id), s.permissions]))
}

function decodeJwk(base64: string) {
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'))
}

const privateKeyPromise = importJWK(decodeJwk(env.get('GATEWAY_JWT_PRIVATE_KEY')), 'EdDSA')

export async function mintInternalJwt(claims: InternalJwtClaims): Promise<string> {
  const privateKey = await privateKeyPromise
  return new SignJWT({
    orgId: claims.orgId,
    scope: claims.scope,
    sub: claims.sub,
    role: claims.role,
    servicePermissions: claims.servicePermissions,
    serviceIds: claims.serviceIds,
    agentEmail: claims.agentEmail,
    agentFirstName: claims.agentFirstName,
    agentLastName: claims.agentLastName,
  })
    .setProtectedHeader({ alg: 'EdDSA' })
    .setIssuedAt()
    .setExpirationTime('2m')
    .setAudience(claims.aud)
    .sign(privateKey)
}
