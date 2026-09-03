import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Invoice from '#models/invoice'
import { runOnTenant } from '#services/tenant_connection_service'

// orgId/serviceId doivent correspondre au seed svc-auth (demo_seeder.ts,
// org "AREGIE Demo Mixte", service "Facturation Hôpital", slug
// facturation-hopital) — mais ces id dépendent de l'historique de la base
// (autoincrement), jamais garantis identiques entre deux environnements.
// Surchargeables par env plutôt que de figer une valeur qui ne vaut que
// pour un seul déploiement. Jamais destiné à tourner ailleurs qu'en
// dev/démo. Invoice vit dans la base tenant du service (voir
// tenant_base_model.ts) : toute écriture doit passer par runOnTenant(),
// jamais un firstOrCreate nu.
const ORG_ID = Number(process.env.DEMO_SEED_ORG_ID ?? 1)
const SERVICE_ID = Number(process.env.DEMO_SEED_SERVICE_ID ?? 3)

export default class extends BaseSeeder {
  async run() {
    const invoice = await runOnTenant(SERVICE_ID, () =>
      Invoice.updateOrCreate(
        { orgId: ORG_ID, serviceId: SERVICE_ID, hospitalReference: 'DEMO-2026-001' },
        {
          orgId: ORG_ID,
          serviceId: SERVICE_ID,
          hospitalReference: 'DEMO-2026-001',
          amountCents: 18750,
          objectLabel: 'Frais de séjour — chambre 204',
          status: 'draft',
          fiscalYear: 2026,
          clientNumber: '006272-00042',
        }
      )
    )

    console.log('--- Seed OK (svc-factures) ---')
    console.log(
      `Facture démo (parcours citoyen) : référence=${invoice.hospitalReference} année=${invoice.fiscalYear} montant=${(invoice.amountCents / 100).toFixed(2)}€`
    )
  }
}
