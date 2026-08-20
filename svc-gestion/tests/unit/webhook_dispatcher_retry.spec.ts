import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import PaymentRequest from '#models/payment_request'
import WebhookDelivery from '#models/webhook_delivery'
import { retryFailedDeliveries } from '#services/webhook_dispatcher_service'

function mockFetch(handler: () => Response) {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = (async () => {
    calls += 1
    return handler()
  }) as typeof fetch
  return {
    callCount: () => calls,
    restore: () => {
      globalThis.fetch = original
    },
  }
}

async function createPaymentRequest() {
  return PaymentRequest.create({
    orgId: '1',
    sourceService: 'billetterie',
    sourceReference: `TEST${Date.now()}${Math.floor(Math.random() * 1000)}`,
    amountCents: 1000,
    status: 'paid',
    paidAt: DateTime.now(),
    frontRedirectUrl: 'https://front.invalid.test/return',
    webhookUrl: 'https://target.invalid.test/webhooks/payfip',
  })
}

test.group('webhook_dispatcher_service#retryFailedDeliveries', () => {
  test('rejoue uniquement les livraisons en échec dont nextRetryAt est passé', async ({
    assert,
  }) => {
    const paymentRequest = await createPaymentRequest()

    const due = await WebhookDelivery.create({
      paymentRequestId: paymentRequest.id,
      eventType: 'paiement.valide',
      targetUrl: paymentRequest.webhookUrl,
      payload: { foo: 'bar' },
      status: 'failed',
      attempts: 1,
      nextRetryAt: DateTime.now().minus({ minutes: 1 }),
    })

    const notYetDue = await WebhookDelivery.create({
      paymentRequestId: paymentRequest.id,
      eventType: 'paiement.valide',
      targetUrl: paymentRequest.webhookUrl,
      payload: { foo: 'bar' },
      status: 'failed',
      attempts: 1,
      nextRetryAt: DateTime.now().plus({ minutes: 5 }),
    })

    const alreadyDelivered = await WebhookDelivery.create({
      paymentRequestId: paymentRequest.id,
      eventType: 'paiement.valide',
      targetUrl: paymentRequest.webhookUrl,
      payload: { foo: 'bar' },
      status: 'delivered',
      attempts: 1,
      nextRetryAt: null,
      deliveredAt: DateTime.now(),
    })

    const mock = mockFetch(() => new Response(JSON.stringify({ received: true }), { status: 200 }))

    try {
      const count = await retryFailedDeliveries()

      assert.equal(count, 1, 'seule la livraison en échec et échue doit être rejouée')
      assert.equal(mock.callCount(), 1)

      await due.refresh()
      assert.equal(due.status, 'delivered')
      assert.equal(due.attempts, 2)

      await notYetDue.refresh()
      assert.equal(notYetDue.status, 'failed', 'pas encore due, ne doit pas être touchée')
      assert.equal(notYetDue.attempts, 1)

      await alreadyDelivered.refresh()
      assert.equal(alreadyDelivered.attempts, 1, 'déjà livrée, ne doit jamais être re-tentée')
    } finally {
      mock.restore()
    }
  })

  test('échec persistant -> reste failed avec un backoff croissant', async ({ assert }) => {
    const paymentRequest = await createPaymentRequest()

    const delivery = await WebhookDelivery.create({
      paymentRequestId: paymentRequest.id,
      eventType: 'paiement.valide',
      targetUrl: paymentRequest.webhookUrl,
      payload: { foo: 'bar' },
      status: 'failed',
      attempts: 2,
      nextRetryAt: DateTime.now().minus({ minutes: 1 }),
    })

    const mock = mockFetch(() => new Response('boom', { status: 500 }))

    try {
      await retryFailedDeliveries()

      await delivery.refresh()
      assert.equal(delivery.status, 'failed')
      assert.equal(delivery.attempts, 3)
      assert.isNotNull(delivery.nextRetryAt)
      // Backoff exponentiel : 2^3 = 8 minutes après cette tentative.
      const expectedMinutes = delivery.nextRetryAt!.diff(DateTime.now(), 'minutes').minutes
      assert.approximately(expectedMinutes, 8, 0.5)
    } finally {
      mock.restore()
    }
  })
})
