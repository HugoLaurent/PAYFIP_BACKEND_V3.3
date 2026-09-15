import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { decodeProtectedHeader, importJWK, jwtVerify, type KeyObject } from 'jose'
import env from '#start/env'

export interface AgentPermissions {
  canSell: boolean
  canScan: boolean
  canManageTariffs: boolean
  canViewHistory: boolean
  canToggleService: boolean
}

export interface InternalAuthPayload {
  orgId: string
  scope: string
  sub?: string
  role?: string
  servicePermissions?: Record<string, AgentPermissions>
}

declare module '@adonisjs/core/http' {
  export interface HttpContext {
    internalAuth: InternalAuthPayload
  }
}

const AUDIENCE = 'svc-auth'

function decodeJwk(base64: string) {
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'))
}

// Un émetteur ne peut signer que pour lui-même : la vérification associe
// chaque jeton à la clé exacte que son en-tête `kid` annonce (jamais
// devinée par essai-erreur sur toutes les clés de confiance), et
// n'accepte le scope du payload que s'il figure dans ce que CE kid a le
// droit de déclarer (voir ALLOWED_SCOPES_BY_KID) — un scope auto-déclaré
// dans le payload ne suffit plus à lui seul. Sans ça, n'importe quel
// service de confiance (même le moins critique) pouvait signer un jeton
// scope: 'staff' et obtenir les droits les plus élevés.
const trustedKeys: Record<string, Promise<KeyObject>> = {
  gateway: importJWK(decodeJwk(env.get('GATEWAY_JWT_PUBLIC_KEY')), 'EdDSA') as Promise<KeyObject>,
  'svc-gestion': importJWK(decodeJwk(env.get('GESTION_JWT_PUBLIC_KEY')), 'EdDSA') as Promise<KeyObject>,
  'svc-factures': importJWK(decodeJwk(env.get('FACTURES_JWT_PUBLIC_KEY')), 'EdDSA') as Promise<KeyObject>,
  'svc-billetterie': importJWK(decodeJwk(env.get('BILLETTERIE_JWT_PUBLIC_KEY')), 'EdDSA') as Promise<KeyObject>,
  'svc-inscription': importJWK(decodeJwk(env.get('INSCRIPTION_JWT_PUBLIC_KEY')), 'EdDSA') as Promise<KeyObject>,
}

const ALLOWED_SCOPES_BY_KID: Record<string, readonly string[]> = {
  gateway: ['staff', 'billetterie', 'factures', 'inscription', 'auth'],
  'svc-gestion': ['gestion'],
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
      role: typeof payload.role === 'string' ? payload.role : undefined,
      servicePermissions: isServicePermissionsMap(payload.servicePermissions)
        ? payload.servicePermissions
        : undefined,
    }

    return next()
  }
}

function isServicePermissionsMap(value: unknown): value is Record<string, AgentPermissions> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every(isAgentPermissions)
  )
}

function isAgentPermissions(value: unknown): value is AgentPermissions {
  return (
    typeof value === 'object' &&
    value !== null &&
    ['canSell', 'canScan', 'canManageTariffs', 'canViewHistory', 'canToggleService'].every(
      (key) => typeof (value as Record<string, unknown>)[key] === 'boolean'
    )
  )
}
