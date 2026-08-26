import * as Sentry from '@sentry/node'
import app from '@adonisjs/core/services/app'
import { type HttpContext, ExceptionHandler } from '@adonisjs/core/http'

export default class HttpExceptionHandler extends ExceptionHandler {
  protected debug = !app.inProduction

  async handle(error: unknown, ctx: HttpContext) {
    return super.handle(error, ctx)
  }

  async report(error: unknown, ctx: HttpContext) {
    // 5xx uniquement : les 4xx (validation, auth...) sont un fonctionnement
    // normal de l'appli, pas des bugs — les envoyer noierait GlitchTip sous
    // du bruit et rendrait les vraies erreurs invisibles.
    const status = ctx.response.response.statusCode
    if (status >= 500) {
      Sentry.captureException(error)
    }

    return super.report(error, ctx)
  }
}
