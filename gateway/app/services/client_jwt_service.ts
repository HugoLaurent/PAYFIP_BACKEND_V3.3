import { SignJWT } from 'jose'
import env from '#start/env'
import type { AgentPermissions } from '#services/svc_auth_client'

const clientSecret = new TextEncoder().encode(env.get('CLIENT_JWT_SECRET'))

export interface ClientTokenData {
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

export async function mintClientToken(data: ClientTokenData): Promise<string> {
  return new SignJWT({
    userId: data.userId,
    orgId: data.orgId,
    orgName: data.orgName,
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    role: data.role,
    services: data.services,
    passwordChangeRequired: data.passwordChangeRequired,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(clientSecret)
}
