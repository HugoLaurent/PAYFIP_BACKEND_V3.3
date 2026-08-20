import type { HttpContext } from '@adonisjs/core/http'
import BudgetCode from '#models/budget_code'
import { depositBudgetCodesValidator } from '#validators/aregie'
import { resolveByNumcli } from '#services/svc_auth_client'

export default class AregieController {
  async deposit(ctx: HttpContext) {
    const { codes } = await ctx.request.validateUsing(depositBudgetCodesValidator)

    const created: string[] = []
    const updated: string[] = []
    const skipped: { numcli: string; code: string; reason: string }[] = []

    for (const line of codes) {
      // Chaque ligne ne porte que le numcli — jamais l'organisme
      // directement, qu'on ne veut pas laisser AREGIE affirmer lui-même.
      const resolved = await resolveByNumcli(line.numcli)
      if (!resolved) {
        skipped.push({ numcli: line.numcli, code: line.code, reason: 'numcli_unknown' })
        continue
      }

      const existing = await BudgetCode.query()
        .where('orgId', resolved.orgId)
        .where('numcli', line.numcli)
        .where('code', line.code)
        .first()

      if (!existing) {
        await BudgetCode.create({
          orgId: resolved.orgId,
          numcli: line.numcli,
          code: line.code,
          label: line.label,
        })
        created.push(`${line.numcli}/${line.code}`)
        continue
      }

      existing.label = line.label
      await existing.save()
      updated.push(`${line.numcli}/${line.code}`)
    }

    return ctx.response.status(201).send({ data: { created, updated, skipped } })
  }
}
