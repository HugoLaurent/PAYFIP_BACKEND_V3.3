import type { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'
import { DateTime } from 'luxon'
import User from '#models/user'
import Organization from '#models/organization'
import { loginValidator } from '#validators/login'
import { isPasswordChangeRequired } from '#services/password_policy_service'

// Hash factice comparé quand l'email n'existe pas, pour que hash.verify()
// (volontairement lent — Argon2) s'exécute dans tous les cas. Sans ça, un
// email inconnu renvoie 401 immédiatement alors qu'un email connu avec un
// mauvais mot de passe attend le temps du hash : cet écart de latence
// permet d'énumérer les emails valides sans jamais tester un mot de passe.
let dummyPasswordHash: string | null = null
async function getDummyPasswordHash(): Promise<string> {
  if (!dummyPasswordHash) {
    dummyPasswordHash = await hash.make('dummy-password-for-constant-time-comparison')
  }
  return dummyPasswordHash
}

export default class AuthController {
  async login(ctx: HttpContext) {
    const { email, password } = await ctx.request.validateUsing(loginValidator)

    const user = await User.query().where('email', email).where('status', 'active').first()

    const passwordValid = await hash.verify(
      user?.passwordHash ?? (await getDummyPasswordHash()),
      password
    )
    if (!user || !passwordValid) {
      return ctx.response.status(401).send({ error: 'invalid_credentials' })
    }

    const organization = await Organization.find(user.orgId)
    // Un organisme suspendu (staff) bloque la connexion de tous ses
    // admins/agents — voir OrganizationsController#update.
    if (organization?.status !== 'active') {
      return ctx.response.status(403).send({ error: 'organization_suspended' })
    }

    const passwordChangeRequired = isPasswordChangeRequired(user)

    user.lastLoginAt = DateTime.now()
    await user.save()

    const [services, servicePermissions] = await Promise.all([
      user.getAccessibleServices(),
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
