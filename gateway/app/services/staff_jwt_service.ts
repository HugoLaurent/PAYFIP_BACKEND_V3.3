import { SignJWT, jwtVerify } from 'jose'
import env from '#start/env'
import type { StaffIdentity } from '#services/staff_oidc_service'

const secret = new TextEncoder().encode(env.get('STAFF_JWT_SECRET'))

export interface StaffTokenData {
  sub: string
  email: string
  name: string | null
}

export async function mintStaffToken(identity: StaffIdentity): Promise<string> {
  return new SignJWT({
    sub: identity.sub,
    email: identity.email,
    name: identity.name,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(secret)
}

export interface StaffAuthPayload {
  sub: string
  email: string
  name: string | null
}

export async function verifyStaffToken(token: string): Promise<StaffAuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') return null
    return {
      sub: payload.sub,
      email: payload.email,
      name: typeof payload.name === 'string' ? payload.name : null,
    }
  } catch {
    return null
  }
}
