import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Tariff from '#models/tariff'
import { runOnTenant } from '#services/tenant_connection_service'

// orgId/serviceId doivent correspondre au seed svc-auth (demo_seeder.ts) —
// mais ces id dépendent de l'historique de la base (autoincrement), jamais
// garantis identiques entre deux environnements (constaté : Piscine
// Municipale A/B = 1/2 en local, 4/5 sur le VPS de démo). Surchargeables
// par env plutôt que de figer des valeurs qui ne valent que pour un seul
// déploiement. Tariff vit dans la base tenant du service (voir
// tenant_base_model.ts) : toute écriture doit passer par runOnTenant(),
// jamais un firstOrCreate nu — oubli présent dans une version antérieure de
// ce fichier, qui aurait levé tenant_connection_not_set au premier
// lancement réel (même piège que svc-inscription/demo_seeder.ts).
const ORG_ID = Number(process.env.DEMO_SEED_ORG_ID ?? 1)
const POOL_A_ID = Number(process.env.DEMO_SEED_SERVICE_ID_POOL_A ?? 1)
const POOL_B_ID = Number(process.env.DEMO_SEED_SERVICE_ID_POOL_B ?? 2)
const VILLAGE_ORG_ID = Number(process.env.DEMO_SEED_VILLAGE_ORG_ID ?? 2)
const VILLAGE_SERVICE_ID = Number(process.env.DEMO_SEED_VILLAGE_SERVICE_ID ?? 4)

export default class extends BaseSeeder {
  async run() {
    const tariffsByService: Record<number, Array<{ orgId: number; tariffType: string; priceCents: number }>> = {
      [POOL_A_ID]: [
        { orgId: ORG_ID, tariffType: 'plein', priceCents: 500 },
        { orgId: ORG_ID, tariffType: 'reduit', priceCents: 300 },
        { orgId: ORG_ID, tariffType: 'enfant', priceCents: 0 },
      ],
      [POOL_B_ID]: [
        { orgId: ORG_ID, tariffType: 'plein', priceCents: 450 },
        { orgId: ORG_ID, tariffType: 'reduit', priceCents: 250 },
      ],
      [VILLAGE_SERVICE_ID]: [
        { orgId: VILLAGE_ORG_ID, tariffType: 'plein', priceCents: 400 },
        { orgId: VILLAGE_ORG_ID, tariffType: 'enfant', priceCents: 0 },
      ],
    }

    let count = 0
    for (const [serviceIdStr, tariffs] of Object.entries(tariffsByService)) {
      const serviceId = Number(serviceIdStr)
      try {
        await runOnTenant(serviceId, async () => {
          for (const t of tariffs) {
            await Tariff.firstOrCreate(
              { serviceId, tariffType: t.tariffType },
              { serviceId, orgId: t.orgId, tariffType: t.tariffType, priceCents: t.priceCents, status: 'active' }
            )
            count++
          }
        })
      } catch (error) {
        // Le service "Piscine du Village" (org secondaire, hors parcours
        // widget démo) n'est pas systématiquement provisionné partout —
        // ne doit jamais faire échouer le seed des services Piscine
        // Municipale A/B qui, eux, sont ceux montrés en démo.
        console.log(`  (service ${serviceId} ignoré : ${(error as Error).message})`)
      }
    }

    console.log(`Seed OK — ${count} tarifs (services ${POOL_A_ID}, ${POOL_B_ID}, ${VILLAGE_SERVICE_ID})`)
  }
}
