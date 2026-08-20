import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import mail from '@adonisjs/mail/services/main'
import EmailDelivery from '#models/email_delivery'
import { attemptDelivery, retryFailedDeliveries } from '#services/email_dispatcher_service'

function uniqueEmail(tag: string): string {
  return `mail-unit-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.fr`
}

test.group('email_dispatcher_service#attemptDelivery', () => {
  test('template + données valides -> sent, plus de retry programmé', async ({ assert }) => {
    mail.fake()
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
      mail.restore()
    }
  })

  test('données invalides pour le template -> failed avec backoff, ne lève pas', async ({
    assert,
  }) => {
    mail.fake()
    try {
      const delivery = await EmailDelivery.create({
        // "code" manquant : la validation du template échoue avant tout
        // envoi SMTP — un banc d'essai simple et déterministe du chemin
        // d'échec, sans dépendre d'un vrai serveur mail indisponible.
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
      mail.restore()
    }
  })
})

test.group('email_dispatcher_service#retryFailedDeliveries', () => {
  test('ne rejoue que les échecs dont nextRetryAt est passé, jamais les "sent"', async ({
    assert,
  }) => {
    mail.fake()
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
      mail.restore()
    }
  })
})
