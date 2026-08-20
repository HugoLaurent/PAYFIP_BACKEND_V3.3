import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Tariff from '#models/tariff'

export default class extends BaseSeeder {
  async run() {
    const tariffs = [
      { orgId: 1, serviceId: 1, tariffType: 'plein', priceCents: 500 },
      { orgId: 1, serviceId: 1, tariffType: 'reduit', priceCents: 300 },
      { orgId: 1, serviceId: 1, tariffType: 'enfant', priceCents: 0 },
      { orgId: 1, serviceId: 2, tariffType: 'plein', priceCents: 450 },
      { orgId: 1, serviceId: 2, tariffType: 'reduit', priceCents: 250 },
      { orgId: 2, serviceId: 4, tariffType: 'plein', priceCents: 400 },
      { orgId: 2, serviceId: 4, tariffType: 'enfant', priceCents: 0 },
    ]

    for (const t of tariffs) {
      await Tariff.firstOrCreate(
        { serviceId: t.serviceId, tariffType: t.tariffType },
        { ...t, status: 'active' }
      )
    }

    console.log(`Seed OK — ${tariffs.length} tarifs (services 1, 2, 4)`)
  }
}
