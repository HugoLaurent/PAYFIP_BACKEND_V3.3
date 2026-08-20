import type { HttpContext } from '@adonisjs/core/http'
import { loginWithCredentials, fetchCurrentProfile } from '#services/svc_auth_client'
import { mintClientToken } from '#services/client_jwt_service'
import { loginValidator } from '#validators/login'

export default class AuthController {
  async login(ctx: HttpContext) {
    const { email, password } = await ctx.request.validateUsing(loginValidator)

    const result = await loginWithCredentials(email, password)
    if (!result) {
      return ctx.response.status(401).send({ error: 'invalid_credentials' })
    }

    const token = await mintClientToken(result)

    return ctx.response.send({
      data: {
        token,
        userId: result.userId,
        orgId: result.orgId,
        orgName: result.orgName,
        email: result.email,
        firstName: result.firstName,
        lastName: result.lastName,
        role: result.role,
        services: result.services,
        passwordChangeRequired: result.passwordChangeRequired,
      },
    })
  }

  async refresh(ctx: HttpContext) {
    const { userId, orgId } = ctx.clientAuth

    const profile = await fetchCurrentProfile(userId, orgId)
    if (!profile) {
      return ctx.response.status(401).send({ error: 'profile_not_found' })
    }

    const token = await mintClientToken({
      userId: profile.id,
      orgId: profile.orgId,
      orgName: profile.orgName,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      role: profile.role,
      services: profile.services,
      passwordChangeRequired: profile.passwordChangeRequired,
    })

    return ctx.response.send({
      data: {
        token,
        userId: profile.id,
        orgId: profile.orgId,
        orgName: profile.orgName,
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        role: profile.role,
        services: profile.services,
        passwordChangeRequired: profile.passwordChangeRequired,
      },
    })
  }
}
