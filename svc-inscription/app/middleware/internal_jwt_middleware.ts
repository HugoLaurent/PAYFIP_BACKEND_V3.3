import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { importJWK, jwtVerify, type KeyObject } from 'jose'
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
  serviceIds?: number[]
  agentEmail?: string | null
  agentFirstName?: string | null
  agentLastName?: string | null
}

declare module '@adonisjs/core/http' {
  export interface HttpContext {
    internalAuth: InternalAuthPayload
  }
}

const AUDIENCE = 'svc-inscription'

function decodeJwk(base64: string) {
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'))
}

// Émetteurs de confiance : le Gateway (citoyen/agent) et svc-gestion (le
// webhook de paiement) — mêmes deux clés que svc-billetterie.
const trustedKeysPromise = Promise.all([
  importJWK(decodeJwk(env.get('GATEWAY_JWT_PUBLIC_KEY')), 'EdDSA') as Promise<KeyObject>,
  importJWK(decodeJwk(env.get('GESTION_JWT_PUBLIC_KEY')), 'EdDSA') as Promise<KeyObject>,
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
      role: typeof payload.role === 'string' ? payload.role : undefined,
      servicePermissions: isServicePermissionsMap(payload.servicePermissions)
        ? payload.servicePermissions
        : undefined,
      serviceIds: Array.isArray(payload.serviceIds)
        ? payload.serviceIds.filter((id): id is number => typeof id === 'number')
        : undefined,
      agentEmail: typeof payload.agentEmail === 'string' ? payload.agentEmail : null,
      agentFirstName: typeof payload.agentFirstName === 'string' ? payload.agentFirstName : null,
      agentLastName: typeof payload.agentLastName === 'string' ? payload.agentLastName : null,
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
