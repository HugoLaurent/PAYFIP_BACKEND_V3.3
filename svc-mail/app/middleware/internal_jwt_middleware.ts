import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { importJWK, jwtVerify, type KeyObject } from 'jose'
import env from '#start/env'

export interface InternalAuthPayload {
  orgId: string
  scope: string
  sub?: string
}

declare module '@adonisjs/core/http' {
  export interface HttpContext {
    internalAuth: InternalAuthPayload
  }
}

const AUDIENCE = 'svc-mail'

function decodeJwk(base64: string) {
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'))
}

const trustedKeysPromise = Promise.all([
  importJWK(decodeJwk(env.get('BILLETTERIE_JWT_PUBLIC_KEY')), 'EdDSA') as Promise<KeyObject>,
  importJWK(decodeJwk(env.get('FACTURES_JWT_PUBLIC_KEY')), 'EdDSA') as Promise<KeyObject>,
  importJWK(decodeJwk(env.get('GATEWAY_JWT_PUBLIC_KEY')), 'EdDSA') as Promise<KeyObject>,
  importJWK(decodeJwk(env.get('INSCRIPTION_JWT_PUBLIC_KEY')), 'EdDSA') as Promise<KeyObject>,
])

export default class InternalJwtMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const header = ctx.request.header('authorization')
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null

    if (!token) {
      return ctx.response.status(401).send({ error: 'missing_internal_token' })
    }

    const trustedKeys = await trustedKeysPromise
    let payload: Record<string, unknown> | undefined

    for (const key of trustedKeys) {
      try {
        const result = await jwtVerify(token, key, { algorithms: ['EdDSA'], audience: AUDIENCE })
        payload = result.payload
        break
      } catch {
        continue
      }
    }

    if (!payload || typeof payload.orgId !== 'string' || typeof payload.scope !== 'string') {
      return ctx.response.status(401).send({ error: 'invalid_internal_token' })
    }

    ctx.internalAuth = {
      orgId: payload.orgId,
      scope: payload.scope,
      sub: typeof payload.sub === 'string' ? payload.sub : undefined,
    }

    return next()
  }
}
