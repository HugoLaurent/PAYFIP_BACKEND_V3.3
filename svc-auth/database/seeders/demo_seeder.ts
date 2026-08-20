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
    const invoicing = await createService(orgMixte, 'Facturation Hôpital', 'factures', '006272')

    await assign(agent, poolA)

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
    console.log(`Org 1 (mixte, id=${orgMixte.id}) : ${poolA.name}, ${poolB.name}, ${invoicing.name}`)
    console.log(`  admin@aregie-demo-mixte.test / password (accès aux 3 services)`)
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
  return Service.firstOrCreate(
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
