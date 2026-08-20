import type { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import Service from '#models/service'
import UserServiceAssignment from '#models/user_service_assignment'
import {
  createAgentValidator,
  updateAgentPermissionsValidator,
  setPasswordValidator,
} from '#validators/user'
import { adminResetPassword, PasswordReusedError } from '#services/password_policy_service'

const listValidator = vine.compile(
  vine.object({
    orgId: vine.number().positive().optional(),
    role: vine.enum(['admin', 'agent'] as const).optional(),
    q: vine.string().trim().optional(),
    page: vine.number().positive().optional(),
    perPage: vine.number().positive().max(100).optional(),
  })
)

class ServiceNotAssignedError extends Error {}

function serializeUser(u: User) {
  return {
    id: u.id,
    orgId: u.orgId,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    status: u.status,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISO() : null,
    services:
      u.role === 'agent'
        ? u.assignments.map((a) => ({
            id: a.serviceId,
            name: a.service.name,
            permissions: {
              canSell: a.canSell,
              canScan: a.canScan,
              canManageTariffs: a.canManageTariffs,
              canViewHistory: a.canViewHistory,
              canToggleService: a.canToggleService,
            },
          }))
        : [],
    createdAt: u.createdAt.toISO(),
  }
}

export default class UsersController {
  async index(ctx: HttpContext) {
    const { scope, role, orgId } = ctx.internalAuth
    const {
      orgId: filterOrgId,
      role: filterRole,
      q,
      page,
      perPage,
    } = await ctx.request.validateUsing(listValidator)

    if (scope === 'staff') {
      const query = User.query()
        .orderBy('id', 'desc')
        .preload('assignments', (q2) => q2.preload('service'))
      if (filterOrgId) query.where('orgId', filterOrgId)
      if (q) query.whereILike('email', `%${q}%`)
      const users = await query.paginate(page ?? 1, perPage ?? 25)
      return ctx.response.send({ data: users.all().map(serializeUser), meta: users.getMeta() })
    }

    if (role === 'admin') {
      // "un admin liste les membres de son organisme" — agents par
      // défaut, ou les autres admins si role=admin est demandé (onglet
      // "Administrateurs" côté front). Un agent ne peut jamais lister
      // les admins (scope_not_allowed plus bas).
      const query = User.query()
        .where('orgId', Number(orgId))
        .where('role', filterRole ?? 'agent')
        // Un utilisateur "supprimé" (soft-delete) ne doit plus jamais
        // réapparaître dans une liste — désactivé, si, c'est justement
        // pour pouvoir le réactiver.
        .whereNot('status', 'deleted')
        .orderBy('id', 'desc')
        .preload('assignments', (q2) => q2.preload('service'))
      if (q) query.whereILike('email', `%${q}%`)
      const users = await query.paginate(page ?? 1, perPage ?? 25)
      return ctx.response.send({ data: users.all().map(serializeUser), meta: users.getMeta() })
    }

    return ctx.response.status(403).send({ error: 'scope_not_allowed' })
  }

  async store(ctx: HttpContext) {
    const { orgId, role } = ctx.internalAuth
    if (role !== 'admin') {
      return ctx.response.status(403).send({ error: 'admin_role_required' })
    }

    const payload = await ctx.request.validateUsing(createAgentValidator)
    const newRole = payload.role ?? 'agent'

    const existing = await User.findBy('email', payload.email)
    if (existing) {
      return ctx.response.status(409).send({ error: 'email_already_used' })
    }

    // Un admin a un accès complet d'office — pas de service à lui
    // assigner. Seul un agent a besoin d'au moins un service.
    if (newRole === 'agent' && (!payload.serviceIds || payload.serviceIds.length === 0)) {
      return ctx.response.status(422).send({ error: 'service_ids_required' })
    }

    const services =
      newRole === 'agent'
        ? await Service.query()
            .where('orgId', Number(orgId))
            .whereIn('id', payload.serviceIds!)
        : []

    if (newRole === 'agent' && services.length !== payload.serviceIds!.length) {
      return ctx.response.status(422).send({ error: 'service_not_in_organization' })
    }

    const user = await db.transaction(async (trx) => {
      const newUser = await User.create(
        {
          orgId: Number(orgId),
          email: payload.email,
          passwordHash: await hash.make(payload.password),
          firstName: payload.firstName,
          lastName: payload.lastName,
          role: newRole,
          status: 'active',
          // Le mot de passe est choisi par un admin à la création — le
          // titulaire du compte doit le changer dès sa première connexion.
          mustChangePassword: true,
          passwordChangedAt: DateTime.now(),
        },
        { client: trx }
      )

      if (newRole === 'agent') {
        await UserServiceAssignment.createMany(
          services.map((service) => ({
            userId: newUser.id,
            serviceId: service.id,
            assignedAt: DateTime.now(),
            canSell: payload.canSell ?? true,
            canScan: payload.canScan ?? true,
            canManageTariffs: payload.canManageTariffs ?? false,
            canViewHistory: payload.canViewHistory ?? true,
            canToggleService: payload.canToggleService ?? false,
          })),
          { client: trx }
        )
      }

      return newUser
    })

    await user.load('assignments', (q) => q.preload('service'))
    return ctx.response.status(201).send({ data: serializeUser(user) })
  }

  async update(ctx: HttpContext) {
    const { orgId, role } = ctx.internalAuth
    if (role !== 'admin') {
      return ctx.response.status(403).send({ error: 'admin_role_required' })
    }

    const user = await User.query()
      .where('id', Number(ctx.params.id))
      .where('orgId', Number(orgId))
      .whereNot('status', 'deleted')
      .first()

    if (!user) {
      return ctx.response.status(404).send({ error: 'agent_not_found' })
    }

    const payload = await ctx.request.validateUsing(updateAgentPermissionsValidator)

    // Un organisme ne doit jamais se retrouver sans aucun admin actif —
    // sans quoi plus personne ne peut se connecter pour en recréer un.
    if (user.role === 'admin' && payload.status === 'inactive') {
      const otherActiveAdmins = await User.query()
        .where('orgId', Number(orgId))
        .where('role', 'admin')
        .where('status', 'active')
        .whereNot('id', user.id)
        .count('* as total')
      if (Number(otherActiveAdmins[0].$extras.total) === 0) {
        return ctx.response.status(409).send({ error: 'cannot_remove_last_admin' })
      }
    }

    if (payload.firstName !== undefined) user.firstName = payload.firstName
    if (payload.lastName !== undefined) user.lastName = payload.lastName
    if (payload.status !== undefined) user.status = payload.status
    if (
      payload.firstName !== undefined ||
      payload.lastName !== undefined ||
      payload.status !== undefined
    ) {
      await user.save()
    }

    if (payload.services) {
      try {
        await db.transaction(async (trx) => {
          for (const entry of payload.services!) {
            const assignment = await UserServiceAssignment.query({ client: trx })
              .where('userId', user.id)
              .where('serviceId', entry.serviceId)
              .first()

            if (!assignment) {
              throw new ServiceNotAssignedError()
            }

            if (entry.canSell !== undefined) assignment.canSell = entry.canSell
            if (entry.canScan !== undefined) assignment.canScan = entry.canScan
            if (entry.canManageTariffs !== undefined) {
              assignment.canManageTariffs = entry.canManageTariffs
            }
            if (entry.canViewHistory !== undefined) assignment.canViewHistory = entry.canViewHistory
            if (entry.canToggleService !== undefined) {
              assignment.canToggleService = entry.canToggleService
            }
            await assignment.useTransaction(trx).save()
          }
        })
      } catch (error) {
        if (error instanceof ServiceNotAssignedError) {
          return ctx.response.status(422).send({ error: 'service_not_assigned_to_agent' })
        }
        throw error
      }
    }

    await user.load('assignments', (q) => q.preload('service'))
    return ctx.response.send({ data: serializeUser(user) })
  }

  /** PATCH /users/:id/password — un admin réinitialise le mot de passe d'un membre de son organisme. */
  async resetPassword(ctx: HttpContext) {
    const { orgId, role } = ctx.internalAuth
    if (role !== 'admin') {
      return ctx.response.status(403).send({ error: 'admin_role_required' })
    }

    const user = await User.query()
      .where('id', Number(ctx.params.id))
      .where('orgId', Number(orgId))
      .whereNot('status', 'deleted')
      .first()

    if (!user) {
      return ctx.response.status(404).send({ error: 'agent_not_found' })
    }

    const payload = await ctx.request.validateUsing(setPasswordValidator)

    try {
      await adminResetPassword(user, payload.newPassword)
    } catch (error) {
      if (error instanceof PasswordReusedError) {
        return ctx.response.status(422).send({ error: 'password_reused' })
      }
      throw error
    }

    return ctx.response.send({ data: { id: user.id } })
  }

  /**
   * DELETE /users/:id — suppression (soft-delete, `status: 'deleted'')
   * réservée à un agent déjà désactivé, jamais un agent encore actif —
   * même logique que TariffsController#destroy : forcer un geste
   * intentionnel en deux temps plutôt qu'un clic accidentel sur un
   * compte en cours d'utilisation. Pas de DELETE SQL : les commandes déjà
   * passées gardent leur agentId, jamais réinterprété comme "utilisateur
   * valide" ailleurs, donc rien à casser en le laissant en base.
   */
  async destroy(ctx: HttpContext) {
    const { orgId, role } = ctx.internalAuth
    if (role !== 'admin') {
      return ctx.response.status(403).send({ error: 'admin_role_required' })
    }

    const user = await User.query()
      .where('id', Number(ctx.params.id))
      .where('orgId', Number(orgId))
      .whereNot('status', 'deleted')
      .first()

    if (!user) {
      return ctx.response.status(404).send({ error: 'agent_not_found' })
    }

    if (user.status !== 'inactive') {
      return ctx.response.status(409).send({ error: 'agent_must_be_deactivated_first' })
    }

    user.status = 'deleted'
    await user.save()

    return ctx.response.status(204).send('')
  }
}
