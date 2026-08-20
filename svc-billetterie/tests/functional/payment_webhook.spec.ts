import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import Order from '#models/order'
import OrderLine from '#models/order_line'
import Ticket from '#models/ticket'
import { mintTestInternalJwt } from '#tests/helpers/internal_auth'

/** Le seul appel sortant du chemin "paid" est l'envoi du mail de confirmation. */
function mockMailFetch() {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = (async () => {
    calls += 1
    return new Response(JSON.stringify({ data: { sent: true } }), { status: 200 })
  }) as typeof fetch
  return {
    callCount: () => calls,
    restore: () => {
      globalThis.fetch = original
    },
  }
}

async function createAwaitingOrder(overrides: Partial<Order> = {}) {
  const order = await Order.create({
    orgId: 1,
    serviceId: 1,
    email: 'citoyen@test.fr',
    visitDate: DateTime.now().plus({ days: 1 }),
    qtyTickets: 2,
    totalAmountCents: 4000,
    status: 'awaiting_payment',
    paymentMethod: 'payfip',
    paymentReference: `BILL${Date.now()}${Math.floor(Math.random() * 1000)}`,
    paymentRequestId: Math.floor(Math.random() * 1_000_000),
    otpVerifiedAt: DateTime.now(),
    ...overrides,
  })

  await OrderLine.create({
    orderId: order.id,
    tariffType: 'plein',
    quantity: 2,
    unitPriceCents: 2000,
  })

  return order
}

async function webhookPayload(order: Order, status: 'paid' | 'failed' = 'paid') {
  return {
    paymentRequestId: order.paymentRequestId,
    sourceReference: order.paymentReference,
    sourceService: 'billetterie',
    status,
    amountCents: order.totalAmountCents,
  }
}

test.group('OrdersController#paymentWebhook', () => {
  test('commande inconnue -> 404', async ({ client }) => {
    const token = await mintTestInternalJwt({ orgId: '1', scope: 'gestion' })
    const res = await client
      .post('/payment-webhooks')
      .header('Authorization', `Bearer ${token}`)
      .json({
        paymentRequestId: 999,
        sourceReference: 'BILL-INEXISTANT',
        sourceService: 'billetterie',
        status: 'paid',
        amountCents: 1000,
      })

    res.assertStatus(404)
    res.assertBodyContains({ error: 'order_not_found' })
  })

  test('montant incohérent -> 422, commande inchangée', async ({ client, assert }) => {
    const token = await mintTestInternalJwt({ orgId: '1', scope: 'gestion' })
    const order = await createAwaitingOrder()
    const payload = await webhookPayload(order)

    const res = await client
      .post('/payment-webhooks')
      .header('Authorization', `Bearer ${token}`)
      .json({ ...payload, amountCents: payload.amountCents! + 1 })

    res.assertStatus(422)
    res.assertBodyContains({ error: 'payment_webhook_mismatch' })

    await order.refresh()
    assert.equal(order.status, 'awaiting_payment')
  })

  test('paid -> confirme la commande et génère les billets une seule fois', async ({
    client,
    assert,
  }) => {
    const token = await mintTestInternalJwt({ orgId: '1', scope: 'gestion' })
    const order = await createAwaitingOrder()
    const payload = await webhookPayload(order)
    const mail = mockMailFetch()

    try {
      const res = await client
        .post('/payment-webhooks')
        .header('Authorization', `Bearer ${token}`)
        .json(payload)

      res.assertStatus(200)
      res.assertBodyContains({ received: true })

      await order.refresh()
      assert.equal(order.status, 'confirmed')

      const tickets = await Ticket.query().where('orderId', order.id)
      assert.lengthOf(tickets, 2)
      assert.equal(mail.callCount(), 1)
    } finally {
      mail.restore()
    }
  })

  test('webhook rejoué (même commande, deux fois) -> idempotent, pas de doublon', async ({
    client,
    assert,
  }) => {
    const token = await mintTestInternalJwt({ orgId: '1', scope: 'gestion' })
    const order = await createAwaitingOrder()
    const payload = await webhookPayload(order)
    const mail = mockMailFetch()

    try {
      const first = await client
        .post('/payment-webhooks')
        .header('Authorization', `Bearer ${token}`)
        .json(payload)
      first.assertStatus(200)

      const second = await client
        .post('/payment-webhooks')
        .header('Authorization', `Bearer ${token}`)
        .json(payload)
      second.assertStatus(200)
      second.assertBodyContains({ received: true, alreadyProcessed: true })

      const tickets = await Ticket.query().where('orderId', order.id)
      assert.lengthOf(tickets, 2, 'le rejeu ne doit pas générer un second lot de billets')
      assert.equal(mail.callCount(), 1, 'le rejeu ne doit pas renvoyer un second email')
    } finally {
      mail.restore()
    }
  })

  test('failed -> annule la commande, aucun billet, aucun email', async ({ client, assert }) => {
    const token = await mintTestInternalJwt({ orgId: '1', scope: 'gestion' })
    const order = await createAwaitingOrder()
    const payload = await webhookPayload(order, 'failed')
    const mail = mockMailFetch()

    try {
      const res = await client
        .post('/payment-webhooks')
        .header('Authorization', `Bearer ${token}`)
        .json(payload)
      res.assertStatus(200)

      await order.refresh()
      assert.equal(order.status, 'cancelled')

      const tickets = await Ticket.query().where('orderId', order.id)
      assert.lengthOf(tickets, 0)
      assert.equal(mail.callCount(), 0)
    } finally {
      mail.restore()
    }
  })
})

