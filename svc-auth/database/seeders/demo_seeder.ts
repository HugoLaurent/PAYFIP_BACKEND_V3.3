import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Organization from '#models/organization'
import User from '#models/user'
import Service, { type ServiceType } from '#models/service'
import UserServiceAssignment from '#models/user_service_assignment'

export default class extends BaseSeeder {
  async run() {
    const orgMixte = await createOrg('AREGIE Demo Mixte', 'aregie-demo-mixte')
    await createAdmin(orgMixte, 'admin@aregie-demo-mixte.test')
    const agent = await createAgent(orgMixte, 'agent@aregie-demo-mixte.test')

    const poolA = await createService(
      orgMixte,
      'Piscine Municipale A',
      'billetterie',
      '095548',
      'piscine-municipale-a'
    )
    const poolB = await createService(
      orgMixte,
      'Piscine Municipale B',
      'billetterie',
      '006271',
      'piscine-municipale-b'
    )
    // Même numcli que Piscine Municipale A / Inscriptions Formations —
    // c'est le seul numcli réellement enrôlé côté PayFiP sandbox pour cet
    // environnement de démo (confirmé en direct : un paiement billetterie
    // avec 095548 aboutit, un paiement facture avec l'ancien 006272
    // échouait en 500 côté svc-gestion). Sans lien avec le type de
    // service — un numcli PayFiP identifie une régie, pas un type d'appli.
    const invoicing = await createService(
      orgMixte,
      'Facturation Hôpital',
      'factures',
      '095548',
      'facturation-hopital'
    )
    const inscriptions = await createService(
      orgMixte,
      'Inscriptions Formations',
      'inscription',
      '095548',
      'inscriptions-formations'
    )

    await assign(agent, poolA)
    await assign(agent, inscriptions)

    const orgBilletterie = await createOrg('Commune Billetterie Seule', 'commune-billetterie-seule')
    await createAdmin(orgBilletterie, 'admin@commune-billetterie-seule.test')
    await createService(
      orgBilletterie,
      'Piscine du Village',
      'billetterie',
      '006273',
      'piscine-du-village'
    )

    const orgFactures = await createOrg('Hôpital Facturation Seule', 'hopital-facturation-seule')
    await createAdmin(orgFactures, 'admin@hopital-facturation-seule.test')
    await createService(orgFactures, 'Facturation Hôpital Sud', 'factures', '006274')

    console.log('--- Seed OK ---')
    console.log(
      `Org 1 (mixte, id=${orgMixte.id}) : ${poolA.name}, ${poolB.name}, ${invoicing.name}, ${inscriptions.name} (id=${inscriptions.id})`
    )
    console.log(`  admin@aregie-demo-mixte.test / password (accès aux 4 services, y compris Inscriptions)`)
    console.log(`  agent@aregie-demo-mixte.test / password (accès à "${poolA.name}" seulement)`)
    console.log(`Org 2 (billetterie seule, id=${orgBilletterie.id})`)
    console.log(`  admin@commune-billetterie-seule.test / password`)
    console.log(`Org 3 (factures seule, id=${orgFactures.id})`)
    console.log(`  admin@hopital-facturation-seule.test / password`)
  }
}

async function createOrg(name: string, domain: string) {
  return Organization.firstOrCreate({ domain }, { name, domain, status: 'active' })
}

async function createAdmin(org: Organization, email: string) {
  return User.firstOrCreate(
    { email },
    { orgId: org.id, email, passwordHash: await hash.make('password'), role: 'admin', status: 'active' }
  )
}

async function createAgent(org: Organization, email: string) {
  return User.firstOrCreate(
    { email },
    { orgId: org.id, email, passwordHash: await hash.make('password'), role: 'agent', status: 'active' }
  )
}

async function createService(
  org: Organization,
  name: string,
  serviceType: ServiceType,
  numcli: string,
  slug: string | null = null
) {
  // updateOrCreate (pas firstOrCreate) : rejouable sur une base déjà
  // seedée, pour backfiller un champ ajouté après coup (ex. le slug de
  // "Facturation Hôpital", nécessaire pour le mode démo).
  return Service.updateOrCreate(
    { orgId: org.id, name },
    { orgId: org.id, name, serviceType, status: 'active', numcli, saisieMode: 'T', slug }
  )
}

async function assign(user: User, service: Service) {
  return UserServiceAssignment.firstOrCreate(
    { userId: user.id, serviceId: service.id },
    { userId: user.id, serviceId: service.id, assignedAt: DateTime.now() }
  )
}
