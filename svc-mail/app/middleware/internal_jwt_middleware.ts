import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { decodeProtectedHeader, importJWK, jwtVerify, type KeyObject } from 'jose'
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

// Voir svc-auth/internal_jwt_middleware.ts pour le raisonnement complet :
// le kid annoncé choisit la clé exacte à vérifier, et le scope du
// payload doit figurer dans ce que ce kid a le droit de déclarer.
const trustedKeys: Record<string, Promise<KeyObject>> = {
  'svc-billetterie': importJWK(decodeJwk(env.get('BILLETTERIE_JWT_PUBLIC_KEY')), 'EdDSA') as Promise<KeyObject>,
  'svc-factures': importJWK(decodeJwk(env.get('FACTURES_JWT_PUBLIC_KEY')), 'EdDSA') as Promise<KeyObject>,
  gateway: importJWK(decodeJwk(env.get('GATEWAY_JWT_PUBLIC_KEY')), 'EdDSA') as Promise<KeyObject>,
  'svc-inscription': importJWK(decodeJwk(env.get('INSCRIPTION_JWT_PUBLIC_KEY')), 'EdDSA') as Promise<KeyObject>,
}

const ALLOWED_SCOPES_BY_KID: Record<string, readonly string[]> = {
  gateway: ['staff', 'billetterie', 'factures', 'inscription', 'auth'],
  'svc-billetterie': ['billetterie'],
  'svc-factures': ['factures'],
  'svc-inscription': ['inscription'],
}

export default class InternalJwtMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const header = ctx.request.header('authorization')
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null

    if (!token) {
      return ctx.response.status(401).send({ error: 'missing_internal_token' })
    }

    let kid: string | undefined
    try {
      ;({ kid } = decodeProtectedHeader(token))
    } catch {
      return ctx.response.status(401).send({ error: 'invalid_internal_token' })
    }

    if (!kid || !trustedKeys[kid]) {
      return ctx.response.status(401).send({ error: 'invalid_internal_token' })
    }
    const keyPromise = trustedKeys[kid]

    let payload: Record<string, unknown> | undefined
    try {
      const key = await keyPromise
      const result = await jwtVerify(token, key, { algorithms: ['EdDSA'], audience: AUDIENCE })
      payload = result.payload
    } catch {
      payload = undefined
    }

    if (!payload || typeof payload.orgId !== 'string' || typeof payload.scope !== 'string') {
      return ctx.response.status(401).send({ error: 'invalid_internal_token' })
    }

    if (!ALLOWED_SCOPES_BY_KID[kid]?.includes(payload.scope)) {
      return ctx.response.status(401).send({ error: 'scope_not_allowed_for_signer' })
    }

    ctx.internalAuth = {
      orgId: payload.orgId,
      scope: payload.scope,
      sub: typeof payload.sub === 'string' ? payload.sub : undefined,
    }

    return next()
  }
}
