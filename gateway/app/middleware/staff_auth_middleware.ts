import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { timingSafeEqual } from 'node:crypto'
import env from '#start/env'

export default class StaffAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const presented = ctx.request.header('x-staff-key') ?? ''
    const expected = env.get('STAFF_API_KEY')

    const presentedBuf = Buffer.from(presented)
    const expectedBuf = Buffer.from(expected)

    const valid =
      presentedBuf.length === expectedBuf.length && timingSafeEqual(presentedBuf, expectedBuf)

    if (!valid) {
      return ctx.response.status(401).send({ error: 'invalid_staff_key' })
    }

    return next()
  }
}
