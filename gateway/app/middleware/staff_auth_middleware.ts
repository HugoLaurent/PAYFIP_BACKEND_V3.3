import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { isRateLimited, recordAttempt, retryAfterSeconds } from '#services/rate_limiter'
import { verifyStaffToken, type StaffAuthPayload } from '#services/staff_jwt_service'

declare module '@adonisjs/core/http' {
  export interface HttpContext {
    staffAuth: StaffAuthPayload
  }
}

export default class StaffAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const ip = ctx.request.ip()

    // Compté seulement sur les échecs : le token est envoyé à chaque appel
    // du panel staff par un utilisateur légitime, donc limiter chaque
    // requête casserait un usage normal — seul un enchaînement d'échecs
    // (token invalide/deviné) doit être bloqué.
    if (isRateLimited(`staff:${ip}`)) {
      ctx.response.header('Retry-After', String(retryAfterSeconds(`staff:${ip}`)))
      return ctx.response.status(429).send({ error: 'too_many_attempts' })
    }

    const header = ctx.request.header('authorization')
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null

    const payload = token ? await verifyStaffToken(token) : null

    if (!payload) {
      recordAttempt(`staff:${ip}`)
      return ctx.response.status(401).send({ error: 'invalid_staff_token' })
    }

    ctx.staffAuth = payload
    return next()
  }
}
