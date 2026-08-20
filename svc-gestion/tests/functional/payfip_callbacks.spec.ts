import { readFileSync } from 'node:fs'
import { test } from '@japa/runner'
import PaymentRequest from '#models/payment_request'

function fixture(name: string): string {
  return readFileSync(new URL(`../fixtures/payfip/${name}`, import.meta.url), 'utf-8')
}

/** P5 "résultat non connu" : ne transitionne rien, suffit pour ces tests. */
function mockPayfipFetch() {
  const original = globalThis.fetch
  globalThis.fetch = (async () =>
    new Response(fixture('recuperer_detail_fault_p5.xml'), { status: 200 })) as typeof fetch
  return () => {
    globalThis.fetch = original
  }
}

async function createPaymentRequest(frontRedirectUrl: string) {
  return PaymentRequest.create({
    orgId: '1',
    sourceService: 'billetterie',
    sourceReference: `TEST${Date.now()}${Math.floor(Math.random() * 1000)}`,
    amountCents: 1000,
    status: 'awaiting_payment',
    payfipIdOp: `idop-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    frontRedirectUrl,
    webhookUrl: 'https://target.invalid.test/webhooks/payfip',
  })
}

test.group('PayfipCallbacksController#return', () => {
  test('idop inconnu -> 404', async ({ client }) => {
    const restore = mockPayfipFetch()
    try {
      const res = await client.get('/payfip/return').qs({ idop: 'idop-inconnu' })
      res.assertStatus(404)
      res.assertBodyContains({ error: 'unknown_idop' })
    } finally {
      restore()
    }
  })

  test('origine dans la whitelist -> redirige avec les paramètres attendus', async ({
    client,
    assert,
  }) => {
    const restore = mockPayfipFetch()
    try {
      const paymentRequest = await createPaymentRequest('http://localhost:5173/return')

      const res = await client
        .get('/payfip/return')
        .qs({ idop: paymentRequest.payfipIdOp })
        .redirects(0)

      res.assertStatus(302)
      const location = new URL(res.headers()['location'] as string)
      assert.equal(location.origin, 'http://localhost:5173')
      assert.equal(location.searchParams.get('idop'), paymentRequest.payfipIdOp)
      assert.equal(location.searchParams.get('sourceReference'), paymentRequest.sourceReference)
    } finally {
      restore()
    }
  })

  test('origine hors whitelist -> 400, aucune redirection (anti open-redirect)', async ({
    client,
  }) => {
    const restore = mockPayfipFetch()
    try {
      const paymentRequest = await createPaymentRequest('https://evil.example.com/steal')

      const res = await client
        .get('/payfip/return')
        .qs({ idop: paymentRequest.payfipIdOp })
        .redirects(0)

      res.assertStatus(400)
      res.assertBodyContains({ error: 'redirect_origin_not_allowed' })
    } finally {
      restore()
    }
  })
})
