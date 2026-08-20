import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { jwtVerify } from 'jose'
import env from '#start/env'

export interface AgentPermissions {
  canSell: boolean
  canScan: boolean
  canManageTariffs: boolean
  canViewHistory: boolean
  canToggleService: boolean
}

export interface ClientService {
  id: number
  name: string
  serviceType: string
  permissions: AgentPermissions
}

export interface ClientAuthPayload {
  userId: number
  orgId: number
  orgName: string | null
  email: string | null
  firstName: string | null
  lastName: string | null
  role: 'admin' | 'agent'
  services: ClientService[]
  passwordChangeRequired: boolean
}

// Seules ces routes restent accessibles tant que le mot de passe doit être
// changé (premier login, ou expiré depuis plus de 90 jours) — tout le reste
// est bloqué au niveau du gateway, pas seulement caché côté front.
const PASSWORD_CHANGE_ALLOWED_ROUTES = new Set(['/auth/me', '/auth/me/password', '/auth/refresh'])

declare module '@adonisjs/core/http' {
  export interface HttpContext {
    clientAuth: ClientAuthPayload
  }
}

const secret = new TextEncoder().encode(env.get('CLIENT_JWT_SECRET'))

export default class ClientAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const header = ctx.request.header('authorization')
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null

    if (!token) {
      return ctx.response.status(401).send({ error: 'missing_client_token' })
    }

    try {
      const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })

      if (
        typeof payload.userId !== 'number' ||
        typeof payload.orgId !== 'number' ||
        (payload.role !== 'admin' && payload.role !== 'agent') ||
        !Array.isArray(payload.services) ||
        !payload.services.every(isClientService)
      ) {
        return ctx.response.status(401).send({ error: 'invalid_client_token_payload' })
      }

      ctx.clientAuth = {
        userId: payload.userId,
        orgId: payload.orgId,
        orgName: typeof payload.orgName === 'string' ? payload.orgName : null,
        email: typeof payload.email === 'string' ? payload.email : null,
        firstName: typeof payload.firstName === 'string' ? payload.firstName : null,
        lastName: typeof payload.lastName === 'string' ? payload.lastName : null,
        role: payload.role,
        services: payload.services,
        passwordChangeRequired: payload.passwordChangeRequired === true,
      }
    } catch {
      return ctx.response.status(401).send({ error: 'invalid_client_token' })
    }

    if (
      ctx.clientAuth.passwordChangeRequired &&
      !PASSWORD_CHANGE_ALLOWED_ROUTES.has(ctx.route?.pattern ?? '')
    ) {
      return ctx.response.status(403).send({ error: 'password_change_required' })
    }

    return next()
  }
}

function isClientService(value: unknown): value is ClientService {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ClientService).id === 'number' &&
    isAgentPermissions((value as ClientService).permissions)
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
