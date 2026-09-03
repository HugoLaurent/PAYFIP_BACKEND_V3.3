import { SignJWT, importJWK } from 'jose'
import env from '#start/env'

function decodeJwk(base64: string) {
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'))
}

const privateKeyPromise = importJWK(decodeJwk(env.get('INSCRIPTION_JWT_PRIVATE_KEY')), 'EdDSA')

export interface InscriptionJwtClaims {
  orgId?: string
  scope?: string
  aud: string
}

export async function mintInscriptionJwt(claims: InscriptionJwtClaims): Promise<string> {
  const privateKey = await privateKeyPromise
  return new SignJWT({ orgId: claims.orgId, scope: claims.scope })
    .setProtectedHeader({ alg: 'EdDSA' })
    .setIssuedAt()
    .setExpirationTime('2m')
    .setAudience(claims.aud)
    .sign(privateKey)
}
