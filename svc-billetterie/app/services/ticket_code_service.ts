import { createHmac, timingSafeEqual } from 'node:crypto'
import env from '#start/env'

const secret = env.get('TICKET_SIGNING_SECRET')

// Le serviceId est embarqué depuis le split par service (DB par
// serviceId) : deux services différents ont chacun leur séquence d'id
// repartant de 1, un ticketId seul ne suffit plus à router vers la bonne
// base sans fan-out (voir order_code_service.ts, même raisonnement).
function signature(serviceId: number, ticketId: number): string {
  return createHmac('sha256', secret)
    .update(`ticket:${serviceId}:${ticketId}`)
    .digest('hex')
    .slice(0, 16)
}

export function encodeTicketCode(serviceId: number, ticketId: number): string {
  return `${serviceId}.${ticketId}.${signature(serviceId, ticketId)}`
}

export interface DecodedTicketCode {
  serviceId: number
  ticketId: number
}

export function decodeTicketCode(code: string): DecodedTicketCode | null {
  const [serviceIdPart, ticketIdPart, sigPart] = code.split('.')
  const serviceId = Number(serviceIdPart)
  const ticketId = Number(ticketIdPart)

  if (
    !serviceIdPart ||
    !ticketIdPart ||
    !sigPart ||
    !Number.isInteger(serviceId) ||
    serviceId <= 0 ||
    !Number.isInteger(ticketId) ||
    ticketId <= 0
  ) {
    return null
  }

  const expected = signature(serviceId, ticketId)
  const a = Buffer.from(sigPart)
  const b = Buffer.from(expected)

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null
  }

  return { serviceId, ticketId }
}
