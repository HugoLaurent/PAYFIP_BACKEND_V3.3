import { SignJWT, importJWK } from 'jose'

const TEST_PRIVATE_KEY_JWK =
  'eyJjcnYiOiJFZDI1NTE5IiwiZCI6IjNvdXI3NTR5Y3JpTUxDSURHT085ZHFaVGp1TVVwdU9uNlhiN3hLQkI3d1kiLCJ4IjoiTjc1VDJmenBqWnZ4UjBvUkFKWENpd19ZZGQ0VnZ0WFdTOElJNVlIUzVGTSIsImt0eSI6Ik9LUCIsImFsZyI6IkVkRFNBIn0='

function decodeJwk(base64: string) {
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'))
}

const privateKeyPromise = importJWK(decodeJwk(TEST_PRIVATE_KEY_JWK), 'EdDSA')

export interface TestJwtClaims {
  orgId: string
  scope: string
  sub?: string
  role?: string
  servicePermissions?: Record<string, unknown>
}

export async function mintTestInternalJwt(claims: TestJwtClaims): Promise<string> {
  const privateKey = await privateKeyPromise
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'EdDSA' })
    .setIssuedAt()
    .setExpirationTime('2m')
    .setAudience('svc-auth')
    .sign(privateKey)
}

export async function mintExpiredTestInternalJwt(claims: TestJwtClaims): Promise<string> {
  const privateKey = await privateKeyPromise
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'EdDSA' })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
    .setAudience('svc-auth')
    .sign(privateKey)
}
