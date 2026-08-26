import * as Sentry from '@sentry/node'
import app from '@adonisjs/core/services/app'
import { type HttpContext, ExceptionHandler } from '@adonisjs/core/http'

export default class HttpExceptionHandler extends ExceptionHandler {
  protected debug = !app.inProduction

  async handle(error: unknown, ctx: HttpContext) {
    // Le bodyparser laisse remonter le SyntaxError natif de JSON.parse tel
    // quel sur un corps malformé — son message expose la position exacte de
    // l'erreur de syntaxe ("... at position 1 (line 1 column 2)"), un détail
    // d'implémentation utile à un attaquant pour fingerprinter la stack,
    // sans intérêt pour un client légitime.
    if (error instanceof SyntaxError) {
      return ctx.response.status(400).send({ error: 'invalid_request_body' })
    }

    return super.handle(error, ctx)
  }

  async report(error: unknown, ctx: HttpContext) {
    // 5xx uniquement : les 4xx (validation, auth, JSON malformé...) sont un
    // fonctionnement normal de l'appli, pas des bugs — les envoyer noierait
    // GlitchTip sous du bruit et rendrait les vraies erreurs invisibles.
    const status = ctx.response.response.statusCode
    if (status >= 500) {
      Sentry.captureException(error)
    }

    return super.report(error, ctx)
  }
}
