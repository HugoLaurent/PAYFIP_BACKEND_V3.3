import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { createHash, timingSafeEqual } from 'node:crypto'
import env from '#start/env'

// La clé AREGIE n'est plus scopée à un organisme : AREGIE dépose pour
// tous les organismes en un seul appel, chaque ligne portant son propre
// numcli — c'est lui, pas la clé, qui détermine l'organisme concerné
// (résolu via svc-auth au moment d'écrire chaque ligne).
const trustedKeyHashes: Buffer[] = env
  .get('AREGIE_API_KEYS')
  .split(',')
  .map((key) => key.trim())
  .filter(Boolean)
  .map((key) => createHash('sha256').update(key).digest())

function isTrustedKey(presented: string): boolean {
  const presentedHash = createHash('sha256').update(presented).digest()
  return trustedKeyHashes.some((hash) => timingSafeEqual(presentedHash, hash))
}

export default class AregieAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const header = ctx.request.header('authorization')
    const presented = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null

    if (!presented) {
      return ctx.response.status(401).send({ error: 'missing_aregie_key' })
    }

    if (!isTrustedKey(presented)) {
      return ctx.response.status(401).send({ error: 'invalid_aregie_key' })
    }

    return next()
  }
}
