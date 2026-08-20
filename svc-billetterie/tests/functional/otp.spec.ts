import { test } from '@japa/runner'
import { mintTestInternalJwt } from '#tests/helpers/internal_auth'

test.group('otp', () => {
  test('demande puis vérification avec le bon code réussit', async ({ client, assert }) => {
    const token = await mintTestInternalJwt({ orgId: '1', scope: 'billetterie' })
    const email = 'otp-http-test@test.fr'

    const requestRes = await client
      .post('/otp/request')
      .header('Authorization', `Bearer ${token}`)
      .json({ email })

    requestRes.assertStatus(200)
    const code = requestRes.body().data.devCode
    assert.match(code, /^\d{6}$/)

    const verifyRes = await client
      .post('/otp/verify')
      .header('Authorization', `Bearer ${token}`)
      .json({ email, code })

    verifyRes.assertStatus(200)
    assert.isTrue(verifyRes.body().data.verified)
  })

  test('un mauvais code renvoie invalid_or_expired_code', async ({ client }) => {
    const token = await mintTestInternalJwt({ orgId: '1', scope: 'billetterie' })
    const email = 'otp-http-wrong@test.fr'

    await client.post('/otp/request').header('Authorization', `Bearer ${token}`).json({ email })

    const res = await client
      .post('/otp/verify')
      .header('Authorization', `Bearer ${token}`)
      .json({ email, code: '000000' })

    res.assertStatus(422)
    res.assertBodyContains({ error: 'invalid_or_expired_code' })
  })

  test('le 5e mauvais essai verrouille (celui qui fait atteindre MAX_VERIFY_ATTEMPTS)', async ({
    client,
  }) => {
    const token = await mintTestInternalJwt({ orgId: '1', scope: 'billetterie' })
    const email = 'otp-http-lockout@test.fr'

    await client.post('/otp/request').header('Authorization', `Bearer ${token}`).json({ email })

    // 4 essais faux : encore de la marge, invalid_or_expired_code.
    for (let i = 0; i < 4; i++) {
      const res = await client
        .post('/otp/verify')
        .header('Authorization', `Bearer ${token}`)
        .json({ email, code: '000000' })
      res.assertStatus(422)
    }

    // Le 5e essai fait passer le compteur à MAX_VERIFY_ATTEMPTS lui-même
    // et verrouille dans la même réponse (voir otp_service.ts::verifyOtp).
    const fifth = await client
      .post('/otp/verify')
      .header('Authorization', `Bearer ${token}`)
      .json({ email, code: '000000' })
    fifth.assertStatus(429)
    fifth.assertBodyContains({ error: 'too_many_attempts' })

    // Reste verrouillé après coup, y compris avec le bon code.
    const sixth = await client
      .post('/otp/verify')
      .header('Authorization', `Bearer ${token}`)
      .json({ email, code: '000000' })
    sixth.assertStatus(429)
  })

  test('la 4e demande en moins d\'une minute est limitée (too_many_requests)', async ({
    client,
  }) => {
    const token = await mintTestInternalJwt({ orgId: '1', scope: 'billetterie' })
    const email = 'otp-http-ratelimit@test.fr'

    for (let i = 0; i < 3; i++) {
      const res = await client
        .post('/otp/request')
        .header('Authorization', `Bearer ${token}`)
        .json({ email })
      res.assertStatus(200)
    }

    const fourth = await client
      .post('/otp/request')
      .header('Authorization', `Bearer ${token}`)
      .json({ email })

    fourth.assertStatus(429)
    fourth.assertBodyContains({ error: 'too_many_requests' })
  })

  test('sans JWT interne valide, accès refusé', async ({ client }) => {
    const res = await client.post('/otp/request').json({ email: 'nope@test.fr' })
    res.assertStatus(401)
  })
})
