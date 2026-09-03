import { createHmac, timingSafeEqual } from 'node:crypto'
import env from '#start/env'

const secret = env.get('TICKET_SIGNING_SECRET')

// Domaine de signature séparé de ticket_code_service ('order:' + le
// préfixe ORD) — un id de commande et un id de billet peuvent coïncider
// numériquement, jamais leurs codes signés. Le serviceId est embarqué
// depuis le split par service (DB par serviceId) : deux services
// différents ont chacun leur séquence d'id repartant de 1, un orderId
// seul ne suffit plus à router vers la bonne base sans fan-out.
function signature(serviceId: number, orderId: number): string {
  return createHmac('sha256', secret)
    .update(`order:${serviceId}:${orderId}`)
    .digest('hex')
    .slice(0, 16)
}

export function encodeOrderCode(serviceId: number, orderId: number): string {
  return `ORD${serviceId}.${orderId}.${signature(serviceId, orderId)}`
}

export interface DecodedOrderCode {
  serviceId: number
  orderId: number
}

export function decodeOrderCode(code: string): DecodedOrderCode | null {
  const match = /^ORD(\d+)\.(\d+)\.(.+)$/.exec(code)
  if (!match) return null

  const serviceId = Number(match[1])
  const orderId = Number(match[2])
  if (!Number.isInteger(serviceId) || serviceId <= 0) return null
  if (!Number.isInteger(orderId) || orderId <= 0) return null

  const expected = signature(serviceId, orderId)
  const a = Buffer.from(match[3])
  const b = Buffer.from(expected)

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null
  }

  return { serviceId, orderId }
}
