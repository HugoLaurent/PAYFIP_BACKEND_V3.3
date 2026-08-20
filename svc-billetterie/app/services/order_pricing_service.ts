import Tariff from '#models/tariff'

export class UnknownTariffTypeError extends Error {
  constructor(readonly tariffType: string) {
    super(`unknown_tariff_type:${tariffType}`)
    this.name = 'UnknownTariffTypeError'
  }
}

export interface RequestedTicketLine {
  tariffType: string
  quantity: number
}

export interface PricedLine extends RequestedTicketLine {
  unitPriceCents: number
}

export interface OrderTotals {
  lines: PricedLine[]
  qtyTickets: number
  totalAmountCents: number
}

/**
 * Vérifie que chaque type de billet demandé existe bien pour ce service
 * et calcule le total — lève si un tariffType est inconnu/inactif. Le
 * filtre par orgId n'est pas qu'un filtre de commodité : il garantit que
 * serviceId appartient bien à l'organisme du token, pas à un autre.
 */
export async function computeOrderTotals(
  orgId: number,
  serviceId: number,
  requested: RequestedTicketLine[]
): Promise<OrderTotals> {
  const tariffs = await Tariff.query().withScopes((scopes) => scopes.active(orgId, serviceId))
  const byType = new Map(tariffs.map((t) => [t.tariffType, t]))

  const lines: PricedLine[] = requested.map((line) => {
    const tariff = byType.get(line.tariffType)
    if (!tariff) {
      throw new UnknownTariffTypeError(line.tariffType)
    }
    return { ...line, unitPriceCents: tariff.priceCents }
  })

  const qtyTickets = lines.reduce((sum, l) => sum + l.quantity, 0)
  const totalAmountCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0)

  return { lines, qtyTickets, totalAmountCents }
}
