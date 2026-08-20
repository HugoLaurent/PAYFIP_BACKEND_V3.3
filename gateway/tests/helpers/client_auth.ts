import { SignJWT } from 'jose'
import type { ClientTokenData } from '#services/client_jwt_service'

/**
 * Mint un JWT client "à la main", indépendamment de mintClientToken —
 * pour tester le middleware/refresh sans dépendre du chemin login.
 */
export async function mintTestClientToken(
  secret: string,
  data: ClientTokenData
): Promise<string> {
  const key = new TextEncoder().encode(secret)
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
    .sign(key)
}
