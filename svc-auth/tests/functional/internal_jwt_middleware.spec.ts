import { test } from '@japa/runner'
import { SignJWT, generateKeyPair } from 'jose'
import { mintTestInternalJwt, mintExpiredTestInternalJwt } from '#tests/helpers/internal_auth'

/**
 * Le middleware protège tous les endpoints internes du service via une
 * seule route de test (/me) — ses réponses 401/404 suffisent à distinguer
 * chaque cas sans dépendre de la logique métier du contrôleur.
 */
test.group('InternalJwtMiddleware', () => {
  test('sans en-tête Authorization -> 401 missing_internal_token', async ({ client }) => {
    const res = await client.get('/me')
    res.assertStatus(401)
    res.assertBodyContains({ error: 'missing_internal_token' })
  })

  test('token illisible -> 401 invalid_internal_token', async ({ client }) => {
    const res = await client.get('/me').header('Authorization', 'Bearer not-a-jwt')
    res.assertStatus(401)
    res.assertBodyContains({ error: 'invalid_internal_token' })
  })

  test('token signé par une clé non approuvée -> 401 invalid_internal_token', async ({
    client,
  }) => {
    const { privateKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true })
    const rogueToken = await new SignJWT({ orgId: '1', scope: 'billetterie' })
      .setProtectedHeader({ alg: 'EdDSA' })
      .setIssuedAt()
      .setExpirationTime('2m')
      .setAudience('svc-auth')
      .sign(privateKey)

    const res = await client.get('/me').header('Authorization', `Bearer ${rogueToken}`)
    res.assertStatus(401)
    res.assertBodyContains({ error: 'invalid_internal_token' })
  })

  test('token expiré (même clé de confiance) -> 401 invalid_internal_token', async ({
    client,
  }) => {
    const expired = await mintExpiredTestInternalJwt({ orgId: '1', scope: 'auth', sub: '1' })
    const res = await client.get('/me').header('Authorization', `Bearer ${expired}`)
    res.assertStatus(401)
    res.assertBodyContains({ error: 'invalid_internal_token' })
  })

  test('token valide sans "sub" -> passe le middleware, 401 token_missing_sub côté contrôleur', async ({
    client,
  }) => {
    const token = await mintTestInternalJwt({ orgId: '1', scope: 'auth' })
    const res = await client.get('/me').header('Authorization', `Bearer ${token}`)
    res.assertStatus(401)
    res.assertBodyContains({ error: 'token_missing_sub' })
  })

  test('token valide avec "sub" inconnu -> passe le middleware, 404 user_not_found', async ({
    client,
  }) => {
    const token = await mintTestInternalJwt({ orgId: '1', scope: 'auth', sub: '999999' })
    const res = await client.get('/me').header('Authorization', `Bearer ${token}`)
    res.assertStatus(404)
    res.assertBodyContains({ error: 'user_not_found' })
  })
})
