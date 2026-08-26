import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { isRateLimited, recordAttempt, retryAfterSeconds } from '#services/rate_limiter'

// Endpoints publics où l'appelant prouve la connaissance d'une donnée
// (référence + montant d'une facture, etc.) plutôt qu'une identité — même
// design anti-oracle que le login (même erreur pour "introuvable" et
// "preuve fausse"), mais sans limite de débit un brute-force en volume
// reste possible. Espace de clés dédié (`public-proof:`), distinct de
// /auth/login et de la clé staff, pour ne pas partager leur budget.
export default class PublicProofRateLimitMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const key = `public-proof:${ctx.request.ip()}`

    if (isRateLimited(key)) {
      ctx.response.header('Retry-After', String(retryAfterSeconds(key)))
      return ctx.response.status(429).send({ error: 'too_many_attempts' })
    }

    recordAttempt(key)
    return next()
  }
}
