import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Invoice from '#models/invoice'
import { depositInvoicesValidator, acknowledgeCollectionValidator } from '#validators/aregie'
import { resolveByNumcli } from '#services/svc_auth_client'
import { runOnTenant, runOnAllTenants } from '#services/tenant_connection_service'

export default class AregieController {
  /**
   * Chaque ligne résout un serviceId unique via resolveByNumcli() avant
   * d'écrire — pas de fan-out en écriture, juste un routage direct vers
   * la base tenant du service concerné (voir F2 du plan de migration
   * DB-per-tenant : cet endpoint est un vrai chemin cross-tenant, une
   * ligne à la fois, pas une lecture agrégée).
   */
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

      await runOnTenant(resolved.serviceId, async () => {
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
          return
        }

        if (existing.status !== 'draft') {
          skipped.push({ reference: line.hospitalReference, reason: existing.status })
          return
        }

        existing.serviceId = resolved.serviceId
        existing.amountCents = line.amountCents
        existing.objectLabel = objectLabel
        existing.aregieStatus = line.aregieStatus
        existing.fiscalYear = line.fiscalYear
        existing.depositedAt = DateTime.now()
        await existing.save()
        updated.push(line.hospitalReference)
      })
    }

    return ctx.response.status(201).send({
      data: { created, updated, skipped },
    })
  }

  /**
   * Toutes les factures payées non encore collectées, tous organismes
   * confondus — AREGIE n'a structurellement aucun organisme à filtrer ici
   * (voir §6 du plan de migration DB-per-tenant). Fan-out sur tous les
   * services factures connus, concurrence plafonnée.
   *
   * `id` est composite ("<serviceId>:<invoiceId>") : l'id de facture seul
   * n'est plus unique globalement depuis le split par service — AREGIE le
   * renvoie tel quel dans acknowledgeCollection().
   */
  async pendingCollection(ctx: HttpContext) {
    const perTenant = await runOnAllTenants((_serviceId) =>
      Invoice.query().where('status', 'confirmed').whereNull('collectedAt').orderBy('id', 'asc')
    )
    const invoices = perTenant.flat()

    return ctx.response.send({
      data: invoices.map((invoice) => ({
        id: `${invoice.serviceId}:${invoice.id}`,
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

  /**
   * Accuse réception d'une collecte — regroupe les ids composites par
   * serviceId pour ne router qu'une requête par base tenant concernée,
   * plutôt qu'un fan-out sur tous les services connus.
   */
  async acknowledgeCollection(ctx: HttpContext) {
    const { invoiceIds } = await ctx.request.validateUsing(acknowledgeCollectionValidator)

    const idsByService = new Map<number, number[]>()
    for (const composite of invoiceIds) {
      const [serviceIdStr, invoiceIdStr] = composite.split(':')
      const serviceId = Number(serviceIdStr)
      const invoiceId = Number(invoiceIdStr)
      idsByService.set(serviceId, [...(idsByService.get(serviceId) ?? []), invoiceId])
    }

    const collectedAt = DateTime.now()
    let acknowledged = 0

    for (const [serviceId, ids] of idsByService) {
      acknowledged += await runOnTenant(serviceId, async () => {
        const count = await Invoice.query()
          .where('status', 'confirmed')
          .whereNull('collectedAt')
          .whereIn('id', ids)
          .update({ collected_at: collectedAt.toSQL() })
        return Array.isArray(count) ? count.length : count
      })
    }

    return ctx.response.send({
      data: { acknowledged, collectedAt: collectedAt.toISO() },
    })
  }
}
