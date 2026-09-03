import { createHmac, timingSafeEqual } from 'node:crypto'
import env from '#start/env'

const secret = env.get('INVOICE_SIGNING_SECRET')

// L'id de facture seul ne suffit plus à désigner une facture de façon
// unique depuis le split par service : deux services différents ont
// chacun leur propre séquence d'id repartant de 1 (voir
// tenant_connection_service.ts). Le code opaque porte donc les deux.
function signature(serviceId: number, invoiceId: number): string {
  return createHmac('sha256', secret)
    .update(`invoice:${serviceId}:${invoiceId}`)
    .digest('hex')
    .slice(0, 16)
}

export function encodeInvoiceCode(serviceId: number, invoiceId: number): string {
  return `INV${serviceId}.${invoiceId}.${signature(serviceId, invoiceId)}`
}

export interface DecodedInvoiceCode {
  serviceId: number
  invoiceId: number
}

export function decodeInvoiceCode(code: string): DecodedInvoiceCode | null {
  const match = /^INV(\d+)\.(\d+)\.(.+)$/.exec(code)
  if (!match) return null

  const serviceId = Number(match[1])
  const invoiceId = Number(match[2])
  if (!Number.isInteger(serviceId) || serviceId <= 0) return null
  if (!Number.isInteger(invoiceId) || invoiceId <= 0) return null

  const expected = signature(serviceId, invoiceId)
  const a = Buffer.from(match[3])
  const b = Buffer.from(expected)

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null
  }

  return { serviceId, invoiceId }
}
