import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Invoice from '#models/invoice'
import { depositInvoicesValidator, acknowledgeCollectionValidator } from '#validators/aregie'
import { resolveByNumcli } from '#services/svc_auth_client'

export default class AregieController {
  async deposit(ctx: HttpContext) {
    const { invoices } = await ctx.request.validateUsing(depositInvoicesValidator)

    const created: string[] = []
    const updated: string[] = []
    const skipped: { reference: string; reason: string }[] = []

    for (const line of invoices) {
      // Chaque ligne ne porte que le numcli — jamais l'organisme ou le
      // serviceId directement, qu'on ne veut pas laisser AREGIE affirmer
      // lui-même.
      const resolved = await resolveByNumcli(line.numcli)
      if (!resolved) {
        skipped.push({ reference: line.hospitalReference, reason: 'numcli_unknown' })
        continue
      }

      // Jamais le libellé métier d'AREGIE tel quel (potentiellement une
      // donnée de santé) : un intitulé générique à partir du nom du
      // service, résolu une seule fois ici plutôt qu'à chaque lecture.
      const objectLabel = `Facture de ${resolved.name}`

      const existing = await Invoice.query()
        .where('orgId', resolved.orgId)
        .where('hospitalReference', line.hospitalReference)
        .first()

      if (!existing) {
        await Invoice.create({
          orgId: resolved.orgId,
          serviceId: resolved.serviceId,
          hospitalReference: line.hospitalReference,
          amountCents: line.amountCents,
          objectLabel,
          aregieStatus: line.aregieStatus,
          fiscalYear: line.fiscalYear,
          status: 'draft',
          depositedAt: DateTime.now(),
        })
        created.push(line.hospitalReference)
        continue
      }

      if (existing.status !== 'draft') {
        skipped.push({ reference: line.hospitalReference, reason: existing.status })
        continue
      }

      existing.serviceId = resolved.serviceId
      existing.amountCents = line.amountCents
      existing.objectLabel = objectLabel
      existing.aregieStatus = line.aregieStatus
      existing.fiscalYear = line.fiscalYear
      existing.depositedAt = DateTime.now()
      await existing.save()
      updated.push(line.hospitalReference)
    }

    return ctx.response.status(201).send({
      data: { created, updated, skipped },
    })
  }

  /** Toutes les factures payées non encore collectées, tous organismes confondus. */
  async pendingCollection(ctx: HttpContext) {
    const invoices = await Invoice.query()
      .where('status', 'confirmed')
      .whereNull('collectedAt')
      .orderBy('id', 'asc')

    return ctx.response.send({
      data: invoices.map((invoice) => ({
        id: invoice.id,
        hospitalReference: invoice.hospitalReference,
        aregieStatus: invoice.aregieStatus,
        fiscalYear: invoice.fiscalYear,
        serviceId: invoice.serviceId,
        objectLabel: invoice.objectLabel,
        amountCents: invoice.amountCents,
        payerEmail: invoice.payerEmail,
        paymentReference: invoice.paymentReference,
        paidAt: invoice.updatedAt?.toISO() ?? null,
      })),
    })
  }

  async acknowledgeCollection(ctx: HttpContext) {
    const { invoiceIds } = await ctx.request.validateUsing(acknowledgeCollectionValidator)

    const collectedAt = DateTime.now()
    const acknowledged = await Invoice.query()
      .where('status', 'confirmed')
      .whereNull('collectedAt')
      .whereIn('id', invoiceIds)
      .update({ collected_at: collectedAt.toSQL() })

    return ctx.response.send({
      data: {
        acknowledged: Array.isArray(acknowledged) ? acknowledged.length : acknowledged,
        collectedAt: collectedAt.toISO(),
      },
    })
  }
}
