import { createHmac, timingSafeEqual } from 'node:crypto'
import env from '#start/env'

const secret = env.get('TICKET_SIGNING_SECRET')

// Domaine de signature séparé de ticket_code_service ('order:' + le
// préfixe ORD) — un id de commande et un id de billet peuvent coïncider
// numériquement, jamais leurs codes signés.
function signature(orderId: number): string {
  return createHmac('sha256', secret).update(`order:${orderId}`).digest('hex').slice(0, 16)
}

export function encodeOrderCode(orderId: number): string {
  return `ORD${orderId}.${signature(orderId)}`
}

export function decodeOrderCode(code: string): number | null {
  const match = /^ORD(\d+)\.(.+)$/.exec(code)
  if (!match) return null

  const orderId = Number(match[1])
  if (!Number.isInteger(orderId) || orderId <= 0) return null

  const expected = signature(orderId)
  const a = Buffer.from(match[2])
  const b = Buffer.from(expected)

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null
  }

  return orderId
}
