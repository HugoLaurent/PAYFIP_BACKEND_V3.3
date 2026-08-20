import { createHmac, timingSafeEqual } from 'node:crypto'
import env from '#start/env'

const secret = env.get('TICKET_SIGNING_SECRET')

function signature(ticketId: number): string {
  return createHmac('sha256', secret).update(String(ticketId)).digest('hex').slice(0, 16)
}

export function encodeTicketCode(ticketId: number): string {
  return `${ticketId}.${signature(ticketId)}`
}

export function decodeTicketCode(code: string): number | null {
  const [idPart, sigPart] = code.split('.')
  const ticketId = Number(idPart)

  if (!idPart || !sigPart || !Number.isInteger(ticketId) || ticketId <= 0) {
    return null
  }

  const expected = signature(ticketId)
  const a = Buffer.from(sigPart)
  const b = Buffer.from(expected)

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null
  }

  return ticketId
}
