import type { HttpContext } from '@adonisjs/core/http'
import BudgetCode from '#models/budget_code'
import { depositBudgetCodesValidator } from '#validators/aregie'
import { resolveByLinkCode } from '#services/svc_auth_client'

export default class AregieController {
  async deposit(ctx: HttpContext) {
    const { codes } = await ctx.request.validateUsing(depositBudgetCodesValidator)

    const created: string[] = []
    const updated: string[] = []
    const skipped: { numcli: string; code: string; reason: string }[] = []

    for (const line of codes) {
      // Chaque ligne porte le link_code (propre au service, unique) —
      // jamais l'organisme ou le serviceId directement, qu'on ne veut pas
      // laisser AREGIE affirmer lui-même. Le numcli reste envoyé par
      // AREGIE mais ne sert plus qu'à un garde-fou de cohérence juste en
      // dessous : il peut désormais être partagé entre plusieurs services.
      const resolved = await resolveByLinkCode(line.linkCode)
      if (!resolved) {
        skipped.push({ numcli: line.numcli, code: line.code, reason: 'link_code_unknown' })
        continue
      }

      if (resolved.numcli !== line.numcli) {
        skipped.push({ numcli: line.numcli, code: line.code, reason: 'numcli_mismatch' })
        continue
      }

      const existing = await BudgetCode.query()
        .where('serviceId', resolved.serviceId)
        .where('code', line.code)
        .first()

      if (!existing) {
        await BudgetCode.create({
          orgId: resolved.orgId,
          serviceId: resolved.serviceId,
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
