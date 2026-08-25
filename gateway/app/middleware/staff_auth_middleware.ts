import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { timingSafeEqual } from 'node:crypto'
import env from '#start/env'
import { isRateLimited, recordAttempt } from '#services/rate_limiter'

export default class StaffAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const ip = ctx.request.ip()

    // Compté seulement sur les échecs : la clé est envoyée à chaque appel
    // du panel staff par un utilisateur légitime, donc limiter chaque
    // requête casserait un usage normal — seul un enchaînement d'échecs
    // (devinette de la clé) doit être bloqué.
    if (isRateLimited(`staff:${ip}`)) {
      return ctx.response.status(429).send({ error: 'too_many_attempts' })
    }

    const presented = ctx.request.header('x-staff-key') ?? ''
    const expected = env.get('STAFF_API_KEY')

    const presentedBuf = Buffer.from(presented)
    const expectedBuf = Buffer.from(expected)

    const valid =
      presentedBuf.length === expectedBuf.length && timingSafeEqual(presentedBuf, expectedBuf)

    if (!valid) {
      recordAttempt(`staff:${ip}`)
      return ctx.response.status(401).send({ error: 'invalid_staff_key' })
    }

    return next()
  }
}
