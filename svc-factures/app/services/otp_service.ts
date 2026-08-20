import { DateTime } from 'luxon'
import { randomInt } from 'node:crypto'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import OtpCode from '#models/otp_code'
import { sendMail } from '#services/svc_mail_client'

const CODE_TTL_MINUTES = 10
const VERIFIED_VALIDITY_MINUTES = 30
const MAX_VERIFY_ATTEMPTS = 5
const REQUEST_RATE_LIMIT_WINDOW_SECONDS = 60
const MAX_REQUESTS_PER_WINDOW = 3

export type OtpRequestResult =
  | { status: 'sent'; devCode?: string }
  | { status: 'rate_limited' }

export async function requestOtp(email: string): Promise<OtpRequestResult> {
  const windowStart = DateTime.now().minus({ seconds: REQUEST_RATE_LIMIT_WINDOW_SECONDS })
  const recentRequests = await OtpCode.query()
    .where('email', email)
    .where('createdAt', '>', windowStart.toSQL())
    .count('* as total')

  if (Number(recentRequests[0].$extras.total) >= MAX_REQUESTS_PER_WINDOW) {
    return { status: 'rate_limited' }
  }

  const code = randomInt(100_000, 999_999).toString()

  await OtpCode.create({
    email,
    code,
    expiresAt: DateTime.now().plus({ minutes: CODE_TTL_MINUTES }),
    verifiedAt: null,
  })

  if (env.get('OTP_MODE') === 'fake') {
    logger.info({ email, code }, 'otp_service: code (fake, non envoyé par email)')
    return { status: 'sent', devCode: code }
  }

  await sendMail({
    template: 'otp_code',
    to: email,
    data: { code, ttlMinutes: CODE_TTL_MINUTES },
  })

  return { status: 'sent' }
}

export type OtpVerifyResult = 'ok' | 'invalid' | 'locked'

export async function verifyOtp(email: string, code: string): Promise<OtpVerifyResult> {
  const otp = await OtpCode.query()
    .where('email', email)
    .whereNull('verifiedAt')
    .where('expiresAt', '>', DateTime.now().toSQL())
    .orderBy('createdAt', 'desc')
    .first()

  if (!otp) return 'invalid'

  if (otp.attempts >= MAX_VERIFY_ATTEMPTS) {
    return 'locked'
  }

  if (otp.code !== code) {
    const rows = await db
      .from('otp_codes')
      .where('id', otp.id)
      .where('attempts', '<', MAX_VERIFY_ATTEMPTS)
      .increment('attempts', 1)
      .returning('attempts')

    const newAttempts = rows[0]?.attempts ?? MAX_VERIFY_ATTEMPTS
    return newAttempts >= MAX_VERIFY_ATTEMPTS ? 'locked' : 'invalid'
  }

  otp.verifiedAt = DateTime.now()
  await otp.save()
  return 'ok'
}

export async function isEmailVerified(email: string): Promise<boolean> {
  const otp = await OtpCode.query()
    .where('email', email)
    .whereNotNull('verifiedAt')
    .where('verifiedAt', '>', DateTime.now().minus({ minutes: VERIFIED_VALIDITY_MINUTES }).toSQL())
    .orderBy('verifiedAt', 'desc')
    .first()

  return otp !== null
}
