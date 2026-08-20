import { SignJWT, importJWK } from 'jose'

const TEST_PRIVATE_KEY_JWK =
  'eyJjcnYiOiJFZDI1NTE5IiwiZCI6Iko1RnBMMEtGV1k5bWxhRUJscjIwSnFwdTdpazV2bHF3VzVNLTZTaklSc1UiLCJ4IjoibHh4ZEdhTGRKNGZTUzRIQThvTmlfWDFZRnF0Snh1ZU0tVEtxVTNjSGp0byIsImt0eSI6Ik9LUCIsImFsZyI6IkVkRFNBIn0='

function decodeJwk(base64: string) {
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'))
}

const privateKeyPromise = importJWK(decodeJwk(TEST_PRIVATE_KEY_JWK), 'EdDSA')

export interface TestJwtClaims {
  orgId: string
  scope: string
  sub?: string
  role?: string
}

export async function mintTestInternalJwt(claims: TestJwtClaims): Promise<string> {
  const privateKey = await privateKeyPromise
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'EdDSA' })
    .setIssuedAt()
    .setExpirationTime('2m')
    .setAudience('svc-factures')
    .sign(privateKey)
}
