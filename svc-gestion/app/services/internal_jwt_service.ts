import { SignJWT, importJWK } from 'jose'
import env from '#start/env'

function decodeJwk(base64: string) {
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'))
}

const privateKeyPromise = importJWK(decodeJwk(env.get('GESTION_JWT_PRIVATE_KEY')), 'EdDSA')

export interface GestionJwtClaims {
  orgId?: string
  scope?: string
  aud: string
}

export async function mintGestionJwt(claims: GestionJwtClaims): Promise<string> {
  const privateKey = await privateKeyPromise
  return new SignJWT({ orgId: claims.orgId, scope: claims.scope })
    .setProtectedHeader({ alg: 'EdDSA' })
    .setIssuedAt()
    .setExpirationTime('2m')
    .setAudience(claims.aud)
    .sign(privateKey)
}
