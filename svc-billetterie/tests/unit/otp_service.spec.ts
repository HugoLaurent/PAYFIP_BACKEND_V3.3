import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import OtpCode from '#models/otp_code'
import { verifyOtp, isEmailVerified } from '#services/otp_service'

function uniqueEmail(tag: string): string {
  return `otp-unit-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.fr`
}

test.group('otp_service#verifyOtp', () => {
  test('code expiré -> invalid (même avec le bon code)', async ({ assert }) => {
    const email = uniqueEmail('expired')
    await OtpCode.create({
      email,
      code: '123456',
      expiresAt: DateTime.now().minus({ minutes: 1 }),
      verifiedAt: null,
    })

    const result = await verifyOtp(email, '123456')
    assert.equal(result, 'invalid')
  })

  test('code déjà vérifié -> ne peut pas être rejoué', async ({ assert }) => {
    const email = uniqueEmail('reuse')
    await OtpCode.create({
      email,
      code: '654321',
      expiresAt: DateTime.now().plus({ minutes: 10 }),
      verifiedAt: null,
    })

    const first = await verifyOtp(email, '654321')
    assert.equal(first, 'ok')

    const second = await verifyOtp(email, '654321')
    assert.equal(second, 'invalid', 'un code déjà consommé ne doit plus valider')
  })

  test('une nouvelle demande rend l\'ancien code caduc', async ({ assert }) => {
    const email = uniqueEmail('superseded')
    await OtpCode.create({
      email,
      code: '111111',
      expiresAt: DateTime.now().plus({ minutes: 10 }),
      verifiedAt: null,
    })
    await OtpCode.create({
      email,
      code: '222222',
      expiresAt: DateTime.now().plus({ minutes: 10 }),
      verifiedAt: null,
    })

    const oldCodeResult = await verifyOtp(email, '111111')
    assert.equal(oldCodeResult, 'invalid', "l'ancien code ne doit plus être accepté")

    const newCodeResult = await verifyOtp(email, '222222')
    assert.equal(newCodeResult, 'ok', 'le code le plus récent doit rester valide')
  })
})

test.group('otp_service#isEmailVerified', () => {
  test('jamais vérifié -> false', async ({ assert }) => {
    assert.isFalse(await isEmailVerified(uniqueEmail('never')))
  })

  test('vérifié récemment -> true', async ({ assert }) => {
    const email = uniqueEmail('recent')
    await OtpCode.create({
      email,
      code: '333333',
      expiresAt: DateTime.now().plus({ minutes: 10 }),
      verifiedAt: DateTime.now(),
    })

    assert.isTrue(await isEmailVerified(email))
  })

  test('vérifié il y a plus de 30 minutes -> false (fenêtre expirée)', async ({ assert }) => {
    const email = uniqueEmail('stale')
    await OtpCode.create({
      email,
      code: '444444',
      expiresAt: DateTime.now().plus({ minutes: 10 }),
      verifiedAt: DateTime.now().minus({ minutes: 31 }),
    })

    assert.isFalse(await isEmailVerified(email))
  })
})
