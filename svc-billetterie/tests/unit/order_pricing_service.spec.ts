import { test } from '@japa/runner'
import Tariff from '#models/tariff'
import { computeOrderTotals, UnknownTariffTypeError } from '#services/order_pricing_service'

function randomServiceId(): number {
  return Math.floor(Math.random() * 1_000_000) + 1
}

test.group('order_pricing_service#computeOrderTotals', () => {
  test('calcule les totaux pour des tarifs valides', async ({ assert }) => {
    const orgId = 1
    const serviceId = randomServiceId()
    await Tariff.create({ orgId, serviceId, tariffType: 'plein', priceCents: 1000, status: 'active' })
    await Tariff.create({ orgId, serviceId, tariffType: 'reduit', priceCents: 500, status: 'active' })

    const totals = await computeOrderTotals(orgId, serviceId, [
      { tariffType: 'plein', quantity: 2 },
      { tariffType: 'reduit', quantity: 3 },
    ])

    assert.equal(totals.qtyTickets, 5)
    assert.equal(totals.totalAmountCents, 2 * 1000 + 3 * 500)
    assert.lengthOf(totals.lines, 2)
  })

  test('tariffType inconnu pour ce service -> UnknownTariffTypeError', async ({ assert }) => {
    const orgId = 1
    const serviceId = randomServiceId()
    await Tariff.create({ orgId, serviceId, tariffType: 'plein', priceCents: 1000, status: 'active' })

    await assert.rejects(
      () => computeOrderTotals(orgId, serviceId, [{ tariffType: 'vip', quantity: 1 }]),
      UnknownTariffTypeError
    )
  })

  test('tarif archivé -> traité comme inconnu, ne doit pas être facturable', async ({
    assert,
  }) => {
    const orgId = 1
    const serviceId = randomServiceId()
    await Tariff.create({
      orgId,
      serviceId,
      tariffType: 'plein',
      priceCents: 1000,
      status: 'archived',
    })

    await assert.rejects(
      () => computeOrderTotals(orgId, serviceId, [{ tariffType: 'plein', quantity: 1 }]),
      UnknownTariffTypeError
    )
  })

  test('un tarif du même type appartenant à un AUTRE organisme ne doit jamais être utilisé', async ({
    assert,
  }) => {
    const serviceId = randomServiceId()
    // Même serviceId, orgId différent : si le filtre orgId sautait, ce
    // tarif "voisin" serait utilisé pour facturer le mauvais organisme.
    await Tariff.create({
      orgId: 999,
      serviceId,
      tariffType: 'plein',
      priceCents: 1000,
      status: 'active',
    })

    await assert.rejects(
      () => computeOrderTotals(1, serviceId, [{ tariffType: 'plein', quantity: 1 }]),
      UnknownTariffTypeError
    )
  })

  test('un tarif du même type sur un AUTRE service du même organisme ne doit pas être utilisé', async ({
    assert,
  }) => {
    const orgId = 1
    const otherServiceId = randomServiceId()
    await Tariff.create({
      orgId,
      serviceId: otherServiceId,
      tariffType: 'plein',
      priceCents: 1000,
      status: 'active',
    })

    await assert.rejects(
      () => computeOrderTotals(orgId, randomServiceId(), [{ tariffType: 'plein', quantity: 1 }]),
      UnknownTariffTypeError
    )
  })
})
