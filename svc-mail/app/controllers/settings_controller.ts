import type { HttpContext } from '@adonisjs/core/http'
import { updateAregieMailApiKeyValidator } from '#validators/staff'
import { getApiKeyStatus, setApiKey } from '#services/aregie_mail_settings_service'

export default class SettingsController {
  async showAregieMailApiKey(ctx: HttpContext) {
    if (ctx.internalAuth.scope !== 'staff') {
      return ctx.response.status(403).send({ error: 'scope_not_allowed' })
    }

    return ctx.response.send({ data: await getApiKeyStatus() })
  }

  async updateAregieMailApiKey(ctx: HttpContext) {
    if (ctx.internalAuth.scope !== 'staff') {
      return ctx.response.status(403).send({ error: 'scope_not_allowed' })
    }

    const { apiKey } = await ctx.request.validateUsing(updateAregieMailApiKeyValidator)
    await setApiKey(apiKey)

    return ctx.response.send({ data: await getApiKeyStatus() })
  }
}
