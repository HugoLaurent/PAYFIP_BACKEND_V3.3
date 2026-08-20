import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type Order from '#models/order'
import Ticket from '#models/ticket'

export async function generateTicketsForOrder(
  order: Order,
  trx?: TransactionClientContract
): Promise<Ticket[]> {
  await order.load('lines')

  const ticketsData = order.lines.flatMap((line) =>
    Array.from({ length: line.quantity }, () => ({
      orderId: order.id,
      orgId: order.orgId,
      serviceId: order.serviceId,
      tariffType: line.tariffType,
      priceAtPurchaseCents: line.unitPriceCents,
      visitDate: order.visitDate,
      status: 'issued' as const,
    }))
  )

  return Ticket.createMany(ticketsData, trx ? { client: trx } : undefined)
}
