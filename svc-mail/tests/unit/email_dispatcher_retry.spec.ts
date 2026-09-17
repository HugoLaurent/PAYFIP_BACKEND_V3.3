import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import EmailDelivery from '#models/email_delivery'
import { attemptDelivery, retryFailedDeliveries } from '#services/email_dispatcher_service'
import { setDefaultApiKey } from '#services/aregie_mail_settings_service'

function uniqueEmail(tag: string): string {
  return `mail-unit-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.fr`
}

// Simule l'API AREGIE Mail (voir email_dispatcher_service.ts) sans réseau :
// on remplace le fetch global le temps du test, et on pose une clé en base
// (elle vit désormais là, plus en variable d'environnement — voir
// aregie_mail_settings_service.ts).
async function fakeAregieMail() {
  const originalFetch = globalThis.fetch
  await setDefaultApiKey('sk_test')
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ success: true, messageId: 'test' }), {
      status: 200,
    })) as typeof fetch

  return () => {
    globalThis.fetch = originalFetch
  }
}

test.group('email_dispatcher_service#attemptDelivery', () => {
  test('template + données valides -> sent, plus de retry programmé', async ({ assert }) => {
    const restore = await fakeAregieMail()
    try {
      const delivery = await EmailDelivery.create({
        template: 'otp_code',
        toEmail: uniqueEmail('ok'),
        data: { code: '123456', ttlMinutes: 10 },
        status: 'pending',
        attempts: 0,
      })

      await attemptDelivery(delivery)

      assert.equal(delivery.status, 'sent')
      assert.isNotNull(delivery.sentAt)
      assert.isNull(delivery.nextRetryAt)
      assert.isNull(delivery.error)
      assert.equal(delivery.attempts, 1)
    } finally {
      restore()
    }
  })

  test('données invalides pour le template -> failed avec backoff, ne lève pas', async ({
    assert,
  }) => {
    const restore = await fakeAregieMail()
    try {
      const delivery = await EmailDelivery.create({
        // "code" manquant : la validation du template échoue avant tout
        // appel à l'API AREGIE Mail — un banc d'essai simple et
        // déterministe du chemin d'échec, sans dépendre d'un vrai envoi.
        template: 'otp_code',
        toEmail: uniqueEmail('bad'),
        data: { ttlMinutes: 10 },
        status: 'pending',
        attempts: 0,
      })

      await attemptDelivery(delivery)

      assert.equal(delivery.status, 'failed')
      assert.isNotNull(delivery.error)
      assert.isNotNull(delivery.nextRetryAt)
      assert.equal(delivery.attempts, 1)
    } finally {
      restore()
    }
  })
})

test.group('email_dispatcher_service#retryFailedDeliveries', () => {
  test('ne rejoue que les échecs dont nextRetryAt est passé, jamais les "sent"', async ({
    assert,
  }) => {
    const restore = await fakeAregieMail()
    try {
      const due = await EmailDelivery.create({
        template: 'otp_code',
        toEmail: uniqueEmail('due'),
        data: { code: '123456', ttlMinutes: 10 },
        status: 'failed',
        attempts: 1,
        nextRetryAt: DateTime.now().minus({ minutes: 1 }),
      })

      const notYetDue = await EmailDelivery.create({
        template: 'otp_code',
        toEmail: uniqueEmail('notyet'),
        data: { code: '123456', ttlMinutes: 10 },
        status: 'failed',
        attempts: 1,
        nextRetryAt: DateTime.now().plus({ minutes: 5 }),
      })

      const alreadySent = await EmailDelivery.create({
        template: 'otp_code',
        toEmail: uniqueEmail('sent'),
        data: { code: '123456', ttlMinutes: 10 },
        status: 'sent',
        attempts: 1,
        sentAt: DateTime.now(),
      })

      const count = await retryFailedDeliveries()
      assert.equal(count, 1)

      await due.refresh()
      assert.equal(due.status, 'sent')

      await notYetDue.refresh()
      assert.equal(notYetDue.status, 'failed')
      assert.equal(notYetDue.attempts, 1, 'pas encore due, ne doit pas être touchée')

      await alreadySent.refresh()
      assert.equal(alreadySent.attempts, 1, 'déjà envoyée, ne doit jamais être re-tentée')
    } finally {
      restore()
    }
  })
})
