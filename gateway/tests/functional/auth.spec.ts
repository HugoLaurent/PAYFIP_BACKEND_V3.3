import { test } from '@japa/runner'
import { jwtVerify } from 'jose'
import env from '#start/env'
import { mintTestClientToken } from '#tests/helpers/client_auth'

const PERMISSIONS = {
  canSell: true,
  canScan: true,
  canManageTariffs: false,
  canViewHistory: true,
  canToggleService: false,
}

/** Simule la réponse de svc-auth pour /auth/login ou /me. */
function mockSvcAuthFetch(handler: (url: string) => { status: number; body: unknown }) {
  const original = globalThis.fetch
  globalThis.fetch = (async (url: string | URL) => {
    const { status, body } = handler(url.toString())
    return new Response(JSON.stringify(body), { status })
  }) as typeof fetch
  return () => {
    globalThis.fetch = original
  }
}

test.group('AuthController#login', () => {
  test('identifiants valides -> renvoie un JWT client signé et cohérent', async ({
    client,
    assert,
  }) => {
    const restore = mockSvcAuthFetch((url) => {
      assert.include(url, '/auth/login')
      return {
        status: 200,
        body: {
          data: {
            userId: 42,
            orgId: 7,
            orgName: 'AREGIE Test',
            role: 'agent',
            services: [{ id: 1, name: 'Piscine', serviceType: 'billetterie', permissions: PERMISSIONS }],
          },
        },
      }
    })

    try {
      const res = await client.post('/auth/login').json({ email: 'a@test.fr', password: 'x' })
      res.assertStatus(200)

      const token = res.body().data.token as string
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(env.get('CLIENT_JWT_SECRET')),
        { algorithms: ['HS256'] }
      )
      assert.equal(payload.userId, 42)
      assert.equal(payload.orgId, 7)
      assert.equal(payload.role, 'agent')
    } finally {
      restore()
    }
  })

  test('identifiants invalides (svc-auth 401) -> 401 invalid_credentials, pas de token', async ({
    client,
  }) => {
    const restore = mockSvcAuthFetch(() => ({ status: 401, body: { error: 'invalid_credentials' } }))

    try {
      const res = await client.post('/auth/login').json({ email: 'a@test.fr', password: 'wrong' })
      res.assertStatus(401)
      res.assertBodyContains({ error: 'invalid_credentials' })
    } finally {
      restore()
    }
  })
})

test.group('AuthController#refresh', () => {
  test('sans token -> 401 missing_client_token', async ({ client }) => {
    const res = await client.post('/auth/refresh')
    res.assertStatus(401)
    res.assertBodyContains({ error: 'missing_client_token' })
  })

  test('token client valide -> relit le profil et renvoie un token à jour', async ({
    client,
    assert,
  }) => {
    const oldToken = await mintTestClientToken(env.get('CLIENT_JWT_SECRET'), {
      userId: 42,
      orgId: 7,
      orgName: 'AREGIE Test',
      email: 'agent@test.local',
      firstName: 'Agent',
      lastName: 'Test',
      role: 'agent',
      services: [{ id: 1, name: 'Piscine', serviceType: 'billetterie', permissions: PERMISSIONS }],
      passwordChangeRequired: false,
    })

    // Les droits ont changé côté svc-auth depuis le login : le refresh doit
    // refléter cette révocation immédiatement, pas seulement à la prochaine
    // reconnexion.
    const restore = mockSvcAuthFetch((url) => {
      assert.include(url, '/me')
      return {
        status: 200,
        body: {
          data: {
            id: 42,
            orgId: 7,
            orgName: 'AREGIE Test',
            role: 'agent',
            services: [],
          },
        },
      }
    })

    try {
      const res = await client
        .post('/auth/refresh')
        .header('Authorization', `Bearer ${oldToken}`)
      res.assertStatus(200)

      const token = res.body().data.token as string
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(env.get('CLIENT_JWT_SECRET')),
        { algorithms: ['HS256'] }
      )
      assert.deepEqual(payload.services, [])
    } finally {
      restore()
    }
  })

  test('profil introuvable côté svc-auth -> 401 profile_not_found', async ({ client }) => {
    const oldToken = await mintTestClientToken(env.get('CLIENT_JWT_SECRET'), {
      userId: 42,
      orgId: 7,
      orgName: null,
      email: 'agent@test.local',
      firstName: null,
      lastName: null,
      role: 'agent',
      services: [],
      passwordChangeRequired: false,
    })
    const restore = mockSvcAuthFetch(() => ({ status: 404, body: { error: 'not_found' } }))

    try {
      const res = await client
        .post('/auth/refresh')
        .header('Authorization', `Bearer ${oldToken}`)
      res.assertStatus(401)
      res.assertBodyContains({ error: 'profile_not_found' })
    } finally {
      restore()
    }
  })
})
