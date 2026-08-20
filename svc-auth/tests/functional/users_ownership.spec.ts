import { test } from '@japa/runner'
import Organization from '#models/organization'
import Service from '#models/service'
import User from '#models/user'
import { mintTestInternalJwt } from '#tests/helpers/internal_auth'

function unique(tag: string): string {
  return `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

async function createOrg() {
  return Organization.create({
    name: unique('org'),
    domain: `${unique('domain')}.test.fr`,
    status: 'active',
  })
}

async function createService(orgId: number) {
  return Service.create({
    orgId,
    name: unique('service'),
    serviceType: 'billetterie',
    status: 'active',
  })
}

test.group('UsersController#store — isolation inter-organismes', () => {
  test("un admin ne peut pas assigner un service d'un AUTRE organisme à son agent", async ({
    client,
    assert,
  }) => {
    const ownOrg = await createOrg()
    const otherOrg = await createOrg()
    const foreignService = await createService(otherOrg.id)

    const token = await mintTestInternalJwt({
      orgId: String(ownOrg.id),
      scope: 'auth',
      role: 'admin',
    })

    const email = `${unique('agent')}@test.fr`
    const res = await client
      .post('/users')
      .header('Authorization', `Bearer ${token}`)
      .json({
        email,
        password: 'secret123',
        serviceIds: [foreignService.id],
      })

    res.assertStatus(422)
    res.assertBodyContains({ error: 'service_not_in_organization' })

    const created = await User.query().where('email', email).first()
    assert.isNull(created, "aucun utilisateur ne doit avoir été créé si l'assignation échoue")
  })

  test('un non-admin (agent) ne peut pas créer de nouvel utilisateur', async ({ client }) => {
    const org = await createOrg()
    const service = await createService(org.id)
    const token = await mintTestInternalJwt({
      orgId: String(org.id),
      scope: 'auth',
      role: 'agent',
    })

    const res = await client
      .post('/users')
      .header('Authorization', `Bearer ${token}`)
      .json({
        email: `${unique('agent')}@test.fr`,
        password: 'secret123',
        serviceIds: [service.id],
      })

    res.assertStatus(403)
  })

  test('un admin peut créer un agent avec un service de SON organisme', async ({
    client,
    assert,
  }) => {
    const org = await createOrg()
    const service = await createService(org.id)
    const token = await mintTestInternalJwt({
      orgId: String(org.id),
      scope: 'auth',
      role: 'admin',
    })

    const email = `${unique('agent')}@test.fr`
    const res = await client
      .post('/users')
      .header('Authorization', `Bearer ${token}`)
      .json({
        email,
        password: 'secret123',
        serviceIds: [service.id],
      })

    res.assertStatus(201)
    const created = await User.query().where('email', email).first()
    assert.isNotNull(created)
    assert.equal(created!.orgId, org.id)
  })
})
