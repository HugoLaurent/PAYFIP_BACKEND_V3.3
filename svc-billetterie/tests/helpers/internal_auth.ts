import { SignJWT, importJWK } from 'jose'

const TEST_PRIVATE_KEY_JWK =
  'eyJjcnYiOiJFZDI1NTE5IiwiZCI6IkZWa0c3TkkyOWxRMGZtck9zbGsydXd3SF9yamNGcS1Jdnk5WkNsei0wR0kiLCJ4IjoiSkZIZkZsYlJEVU9hRGhaT241bVBpeG5maHFXYmRla3V1UzlwTVAzSGw1USIsImt0eSI6Ik9LUCIsImFsZyI6IkVkRFNBIn0='

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
  serviceIds?: number[]
}

export async function mintTestInternalJwt(claims: TestJwtClaims): Promise<string> {
  const privateKey = await privateKeyPromise
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'EdDSA' })
    .setIssuedAt()
    .setExpirationTime('2m')
    .setAudience('svc-billetterie')
    .sign(privateKey)
}
