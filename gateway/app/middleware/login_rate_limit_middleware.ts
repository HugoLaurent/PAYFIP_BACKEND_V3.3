import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { isRateLimited, recordAttempt } from '#services/rate_limiter'

// Un formulaire de login légitime n'est jamais soumis 10 fois en 5 minutes
// — contrairement à la clé staff (envoyée à chaque appel), compter chaque
// tentative ici, pas seulement les échecs, ne gêne aucun usage normal.
export default class LoginRateLimitMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const key = ctx.request.ip()

    if (isRateLimited(key)) {
      return ctx.response.status(429).send({ error: 'too_many_attempts' })
    }

    recordAttempt(key)
    return next()
  }
}
