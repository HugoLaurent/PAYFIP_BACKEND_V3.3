import type { HttpContext } from '@adonisjs/core/http'
import { requestOtp, verifyOtp } from '#services/otp_service'
import { requestOtpValidator, verifyOtpValidator } from '#validators/otp'

export default class OtpsController {
  async request(ctx: HttpContext) {
    const { email } = await ctx.request.validateUsing(requestOtpValidator)
    const result = await requestOtp(email)

    if (result.status === 'rate_limited') {
      return ctx.response.status(429).send({ error: 'too_many_requests' })
    }

    return ctx.response.send({ data: { sent: true, devCode: result.devCode } })
  }

  async verify(ctx: HttpContext) {
    const { email, code } = await ctx.request.validateUsing(verifyOtpValidator)
    const result = await verifyOtp(email, code)

    if (result === 'locked') {
      return ctx.response.status(429).send({ error: 'too_many_attempts' })
    }
    if (result === 'invalid') {
      return ctx.response.status(422).send({ error: 'invalid_or_expired_code' })
    }

    return ctx.response.send({ data: { verified: true } })
  }
}
