import type { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'
import User from '#models/user'
import Organization from '#models/organization'
import { updateOwnProfileValidator, changeOwnPasswordValidator } from '#validators/user'
import {
  isPasswordChangeRequired,
  selfChangePassword,
  PasswordReusedError,
} from '#services/password_policy_service'

export default class ProfileController {
  async show(ctx: HttpContext) {
    const userId = ctx.internalAuth.sub ? Number(ctx.internalAuth.sub) : null

    if (!userId || Number.isNaN(userId)) {
      return ctx.response.status(401).send({ error: 'token_missing_sub' })
    }

    const user = await User.query().where('id', userId).where('status', 'active').first()

    if (!user) {
      return ctx.response.status(404).send({ error: 'user_not_found' })
    }

    const [services, servicePermissions, organization] = await Promise.all([
      user.getAccessibleServices(),
      user.servicePermissions(),
      Organization.find(user.orgId),
    ])

    return ctx.response.send({
      data: {
        id: user.id,
        orgId: user.orgId,
        orgName: organization?.name ?? null,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        passwordChangeRequired: isPasswordChangeRequired(user),
        services: services.map((service) => ({
          id: service.id,
          name: service.name,
          serviceType: service.serviceType,
          numcli: service.numcli,
          permissions: servicePermissions[service.id],
        })),
      },
    })
  }

  /**
   * PATCH /me — n'importe quel utilisateur (admin ou agent) renseigne son
   * propre prénom/nom. Distinct de UsersController#update (qui ne cible
   * que des agents, par un admin) : ici c'est toujours soi-même, aucun
   * autre champ n'est modifiable par cette route.
   */
  async update(ctx: HttpContext) {
    const userId = ctx.internalAuth.sub ? Number(ctx.internalAuth.sub) : null

    if (!userId || Number.isNaN(userId)) {
      return ctx.response.status(401).send({ error: 'token_missing_sub' })
    }

    const user = await User.query().where('id', userId).where('status', 'active').first()

    if (!user) {
      return ctx.response.status(404).send({ error: 'user_not_found' })
    }

    const payload = await ctx.request.validateUsing(updateOwnProfileValidator)
    user.firstName = payload.firstName
    user.lastName = payload.lastName
    await user.save()

    return ctx.response.send({
      data: { id: user.id, firstName: user.firstName, lastName: user.lastName },
    })
  }

  /** PATCH /me/password — n'importe quel utilisateur change son propre mot de passe. */
  async changePassword(ctx: HttpContext) {
    const userId = ctx.internalAuth.sub ? Number(ctx.internalAuth.sub) : null

    if (!userId || Number.isNaN(userId)) {
      return ctx.response.status(401).send({ error: 'token_missing_sub' })
    }

    const user = await User.query().where('id', userId).where('status', 'active').first()

    if (!user) {
      return ctx.response.status(404).send({ error: 'user_not_found' })
    }

    const payload = await ctx.request.validateUsing(changeOwnPasswordValidator)

    const currentValid = await hash.verify(user.passwordHash, payload.currentPassword)
    if (!currentValid) {
      return ctx.response.status(401).send({ error: 'invalid_current_password' })
    }

    try {
      await selfChangePassword(user, payload.newPassword)
    } catch (error) {
      if (error instanceof PasswordReusedError) {
        return ctx.response.status(422).send({ error: 'password_reused' })
      }
      throw error
    }

    return ctx.response.send({ data: { ok: true } })
  }
}
