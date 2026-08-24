import type { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Organization from '#models/organization'
import User from '#models/user'
import { createOrganizationValidator, updateOrganizationValidator } from '#validators/organization'

function serializeOrganization(o: Organization) {
  return {
    id: o.id,
    name: o.name,
    domain: o.domain,
    status: o.status,
    suspendedAt: o.suspendedAt?.toISO() ?? null,
    suspendedMessage: o.suspendedMessage,
  }
}

export default class OrganizationsController {
  async index(ctx: HttpContext) {
    if (ctx.internalAuth.scope !== 'staff') {
      return ctx.response.status(403).send({ error: 'scope_not_allowed' })
    }

    // Contrairement à avant : on ne filtre plus sur status='active' — le
    // staff doit aussi voir les organismes suspendus dans la liste (badge
    // dédié côté front), c'est justement ce panel qui les gère.
    const organizations = await Organization.query().whereNot('status', 'deleted').orderBy('id')

    return ctx.response.send({ data: organizations.map(serializeOrganization) })
  }

  /**
   * PATCH /organizations/:id — staff only. Renommer et/ou
   * suspendre/réactiver un organisme (jamais de suppression ici, voir
   * ORGANIZATION_STATUSES — 'deleted' n'est pas atteignable par cette
   * route). Suspendre un organisme déconnecte tous ses admins/agents
   * (voir AuthController#login et ProfileController#show côté svc-auth)
   * et fait apparaître "fermé" tous ses services publics (voir
   * ServicesController#lookupBySlug/#status) sans toucher au statut
   * individuel de chaque service.
   */
  async update(ctx: HttpContext) {
    if (ctx.internalAuth.scope !== 'staff') {
      return ctx.response.status(403).send({ error: 'scope_not_allowed' })
    }

    const organization = await Organization.find(Number(ctx.params.id))
    if (!organization) {
      return ctx.response.status(404).send({ error: 'organization_not_found' })
    }

    const payload = await ctx.request.validateUsing(updateOrganizationValidator)

    if (payload.name !== undefined) {
      organization.name = payload.name
    }
    if (payload.status !== undefined) {
      organization.status = payload.status
      if (payload.status === 'suspended') {
        organization.suspendedAt = DateTime.now()
        organization.suspendedMessage = payload.suspendedMessage ?? null
      } else {
        organization.suspendedAt = null
        organization.suspendedMessage = null
      }
    }

    await organization.save()

    return ctx.response.send({ data: serializeOrganization(organization) })
  }

  async store(ctx: HttpContext) {
    if (ctx.internalAuth.scope !== 'staff') {
      return ctx.response.status(403).send({ error: 'scope_not_allowed' })
    }

    const payload = await ctx.request.validateUsing(createOrganizationValidator)

    const existing = await Organization.findBy('domain', payload.domain)
    if (existing) {
      return ctx.response.status(409).send({ error: 'domain_already_taken' })
    }

    const { organization, admin } = await db.transaction(async (trx) => {
      const newOrganization = await Organization.create(
        {
          name: payload.name,
          domain: payload.domain,
          status: 'active',
        },
        { client: trx }
      )

      const newAdmin = await User.create(
        {
          orgId: newOrganization.id,
          email: payload.adminEmail,
          passwordHash: await hash.make(payload.adminPassword),
          role: 'admin',
          status: 'active',
        },
        { client: trx }
      )

      return { organization: newOrganization, admin: newAdmin }
    })

    return ctx.response.status(201).send({
      data: { id: organization.id, name: organization.name, domain: organization.domain, adminEmail: admin.email },
    })
  }
}
