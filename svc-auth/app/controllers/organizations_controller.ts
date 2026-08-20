import type { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'
import db from '@adonisjs/lucid/services/db'
import Organization from '#models/organization'
import User from '#models/user'
import { createOrganizationValidator } from '#validators/organization'

export default class OrganizationsController {
  async index(ctx: HttpContext) {
    if (ctx.internalAuth.scope !== 'staff') {
      return ctx.response.status(403).send({ error: 'scope_not_allowed' })
    }

    const organizations = await Organization.query().where('status', 'active').orderBy('id')

    return ctx.response.send({
      data: organizations.map((o) => ({ id: o.id, name: o.name, domain: o.domain })),
    })
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
