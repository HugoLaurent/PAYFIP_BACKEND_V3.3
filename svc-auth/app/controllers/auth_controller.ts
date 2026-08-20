import type { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'
import { DateTime } from 'luxon'
import User from '#models/user'
import Organization from '#models/organization'
import { loginValidator } from '#validators/login'
import { isPasswordChangeRequired } from '#services/password_policy_service'

export default class AuthController {
  async login(ctx: HttpContext) {
    const { email, password } = await ctx.request.validateUsing(loginValidator)

    const user = await User.query().where('email', email).where('status', 'active').first()

    if (!user) {
      return ctx.response.status(401).send({ error: 'invalid_credentials' })
    }

    const passwordValid = await hash.verify(user.passwordHash, password)
    if (!passwordValid) {
      return ctx.response.status(401).send({ error: 'invalid_credentials' })
    }

    const passwordChangeRequired = isPasswordChangeRequired(user)

    user.lastLoginAt = DateTime.now()
    await user.save()

    const [services, organization, servicePermissions] = await Promise.all([
      user.getAccessibleServices(),
      Organization.find(user.orgId),
      user.servicePermissions(),
    ])

    return ctx.response.send({
      data: {
        userId: user.id,
        orgId: user.orgId,
        orgName: organization?.name ?? null,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        passwordChangeRequired,
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
}
