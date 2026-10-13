import type { HttpContext } from '@adonisjs/core/http'
import ServiceSettings from '#models/service_settings'
import { updateServiceSettingsValidator } from '#validators/service_settings'
import { runOnTenant } from '#services/tenant_connection_service'

function serialize(settings: ServiceSettings | null) {
  return {
    documentContactEmail: settings?.documentContactEmail ?? null,
    documentContactCc: settings?.documentContactCc ?? [],
  }
}

export default class ServiceSettingsController {
  /** GET /services/:id/settings — réglages du service (agents de ce service). */
  async show(ctx: HttpContext) {
    const { scope, serviceIds } = ctx.internalAuth
    const serviceId = Number(ctx.params.id)

    if (scope !== 'staff' && !serviceIds?.includes(serviceId)) {
      return ctx.response.status(403).send({ error: 'service_not_allowed_for_agent' })
    }

    return runOnTenant(serviceId, async () => {
      const settings = await ServiceSettings.first()
      return ctx.response.send({ data: serialize(settings) })
    })
  }

  /**
   * PUT /services/:id/settings — adresse de réception des pièces et copies.
   * Même permission que les autres réglages d'exploitation du service
   * (admin d'organisme ou canToggleService, voir svc-auth#update).
   */
  async update(ctx: HttpContext) {
    const { scope, role, servicePermissions, serviceIds } = ctx.internalAuth
    const serviceId = Number(ctx.params.id)
    const isStaff = scope === 'staff'

    if (!isStaff) {
      if (!serviceIds?.includes(serviceId)) {
        return ctx.response.status(403).send({ error: 'service_not_allowed_for_agent' })
      }
      if (role !== 'admin' && !servicePermissions?.[String(serviceId)]?.canToggleService) {
        return ctx.response.status(403).send({ error: 'permission_required' })
      }
    }

    const payload = await ctx.request.validateUsing(updateServiceSettingsValidator)

    return runOnTenant(serviceId, async () => {
      const settings = await ServiceSettings.updateOrCreate(
        { id: 1 },
        {
          documentContactEmail: payload.documentContactEmail,
          documentContactCc: payload.documentContactCc,
        }
      )
      return ctx.response.send({ data: serialize(settings) })
    })
  }
}
