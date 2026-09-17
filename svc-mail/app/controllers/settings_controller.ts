import type { HttpContext } from '@adonisjs/core/http'
import { updateAregieMailApiKeyValidator } from '#validators/staff'
import { getDefaultApiKeyStatus, setDefaultApiKey } from '#services/aregie_mail_settings_service'

// Clé API AREGIE Mail "par défaut" (emails sans service, ex. OTP). La clé
// propre à un service vit côté svc-auth — voir
// svc-auth/app/controllers/services_controller.ts.
export default class SettingsController {
  async showDefaultApiKey(ctx: HttpContext) {
    if (ctx.internalAuth.scope !== 'staff') {
      return ctx.response.status(403).send({ error: 'scope_not_allowed' })
    }

    return ctx.response.send({ data: await getDefaultApiKeyStatus() })
  }

  async updateDefaultApiKey(ctx: HttpContext) {
    if (ctx.internalAuth.scope !== 'staff') {
      return ctx.response.status(403).send({ error: 'scope_not_allowed' })
    }

    const { apiKey } = await ctx.request.validateUsing(updateAregieMailApiKeyValidator)
    await setDefaultApiKey(apiKey)

    return ctx.response.send({ data: await getDefaultApiKeyStatus() })
  }
}
