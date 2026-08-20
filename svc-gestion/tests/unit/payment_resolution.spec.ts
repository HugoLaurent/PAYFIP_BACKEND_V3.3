import { readFileSync } from 'node:fs'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import PaymentRequest from '#models/payment_request'
import WebhookDelivery from '#models/webhook_delivery'
import PaymentResolutionAttempt from '#models/payment_resolution_attempt'
import { resolvePayment } from '#services/payment_resolution_service'

function fixture(name: string): string {
  return readFileSync(new URL(`../fixtures/payfip/${name}`, import.meta.url), 'utf-8')
}

/**
 * Le seul point de sortie réseau ici est fetch — utilisé à la fois par
 * RealPayfipClient (SOAP vers PAYFIP_SOAP_URL) et par le dispatch de
 * webhook (JSON vers paymentRequest.webhookUrl). On distingue les deux
 * par l'URL appelée.
 */
function mockFetch(payfipXmlFixture: string) {
  const original = globalThis.fetch
  const webhookCalls: string[] = []

  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const href = url.toString()
    if (href.includes('payfip.invalid.test')) {
      return new Response(fixture(payfipXmlFixture), { status: 200 })
    }
    webhookCalls.push(href)
    void init
    return new Response(JSON.stringify({ received: true }), { status: 200 })
  }) as typeof fetch

  return {
    webhookCalls,
    restore: () => {
      globalThis.fetch = original
    },
  }
}

async function createPaymentRequest(overrides: Partial<PaymentRequest> = {}) {
  return PaymentRequest.create({
    orgId: '1',
    sourceService: 'billetterie',
    sourceReference: `TEST${Date.now()}${Math.floor(Math.random() * 1000)}`,
    amountCents: 1000,
    status: 'awaiting_payment',
    payfipIdOp: `idop-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    frontRedirectUrl: 'https://front.invalid.test/return',
    webhookUrl: 'https://target.invalid.test/webhooks/payfip',
    ...overrides,
  })
}

test.group('resolvePayment', () => {
  test('idop inconnu -> renvoie null, ne touche rien', async ({ assert }) => {
    const mock = mockFetch('recuperer_detail_success_paid_cb.xml')
    try {
      const result = await resolvePayment('idop-inexistant', 'urlnotif')
      assert.isNull(result)
      assert.lengthOf(mock.webhookCalls, 0)
    } finally {
      mock.restore()
    }
  })

  test('paiement payé -> passe en paid, journalise la tentative, dispatch le webhook', async ({
    assert,
  }) => {
    const paymentRequest = await createPaymentRequest()
    const mock = mockFetch('recuperer_detail_success_paid_cb.xml')

    try {
      const result = await resolvePayment(paymentRequest.payfipIdOp!, 'urlnotif')

      assert.isNotNull(result)
      assert.equal(result!.status, 'paid')
      assert.isNotNull(result!.paidAt)

      const attempts = await PaymentResolutionAttempt.query().where(
        'paymentRequestId',
        paymentRequest.id
      )
      assert.lengthOf(attempts, 1)
      assert.equal(attempts[0].resultingStatus, 'paid')

      const deliveries = await WebhookDelivery.query().where(
        'paymentRequestId',
        paymentRequest.id
      )
      assert.lengthOf(deliveries, 1)
      assert.equal(deliveries[0].eventType, 'paiement.valide')
      assert.lengthOf(mock.webhookCalls, 1)
    } finally {
      mock.restore()
    }
  })

  test('paiement refusé -> passe en failed, dispatch paiement.echec', async ({ assert }) => {
    const paymentRequest = await createPaymentRequest()
    const mock = mockFetch('recuperer_detail_success_refus.xml')

    try {
      const result = await resolvePayment(paymentRequest.payfipIdOp!, 'urlnotif')

      assert.equal(result!.status, 'failed')
      assert.isNull(result!.paidAt)

      const deliveries = await WebhookDelivery.query().where(
        'paymentRequestId',
        paymentRequest.id
      )
      assert.lengthOf(deliveries, 1)
      assert.equal(deliveries[0].eventType, 'paiement.echec')
    } finally {
      mock.restore()
    }
  })

  test('résultat "non connu" (P5) -> ne change pas le statut, pas de webhook', async ({
    assert,
  }) => {
    const paymentRequest = await createPaymentRequest()
    const mock = mockFetch('recuperer_detail_fault_p5.xml')

    try {
      const result = await resolvePayment(paymentRequest.payfipIdOp!, 'urlnotif')

      assert.equal(result!.status, 'awaiting_payment')
      assert.lengthOf(mock.webhookCalls, 0)

      const attempts = await PaymentResolutionAttempt.query().where(
        'paymentRequestId',
        paymentRequest.id
      )
      assert.lengthOf(attempts, 1, 'la tentative doit être journalisée même sans transition')
    } finally {
      mock.restore()
    }
  })

  test('idempotence : un statut déjà final ne se re-transitionne pas et ne redispatch pas de webhook', async ({
    assert,
  }) => {
    const paymentRequest = await createPaymentRequest({
      status: 'paid',
      paidAt: DateTime.now().minus({ minutes: 5 }),
    })
    const mock = mockFetch('recuperer_detail_success_paid_cb.xml')

    try {
      const result = await resolvePayment(paymentRequest.payfipIdOp!, 'urlredirect')

      assert.equal(result!.status, 'paid')
      // Aucun nouveau webhook : le rejeu (retour navigateur après un
      // notify déjà traité) ne doit pas notifier une seconde fois.
      assert.lengthOf(mock.webhookCalls, 0)

      const deliveries = await WebhookDelivery.query().where(
        'paymentRequestId',
        paymentRequest.id
      )
      assert.lengthOf(deliveries, 0)

      // La tentative de résolution, elle, est toujours journalisée —
      // c'est le seul historique de "PayFiP a été interrogé à cet instant".
      const attempts = await PaymentResolutionAttempt.query().where(
        'paymentRequestId',
        paymentRequest.id
      )
      assert.lengthOf(attempts, 1)
    } finally {
      mock.restore()
    }
  })
})
