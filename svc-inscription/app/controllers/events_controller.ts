import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import type { HttpContext } from '@adonisjs/core/http'
import Event from '#models/event'
import Registration from '#models/registration'
import { createEventValidator, updateEventValidator, listEventsAgentValidator } from '#validators/event'
import { computeSeatsHeld } from '#services/capacity_service'

const publicListValidator = vine.compile(
  vine.object({
    serviceId: vine.number().positive(),
  })
)

const publicBySlugValidator = vine.compile(
  vine.object({
    serviceId: vine.number().positive(),
  })
)

const COMBINING_DIACRITICS = /[̀-ͯ]/g

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Résout un slug unique pour (orgId, serviceId) — jamais recalculé après
 * coup si `title` change ensuite (voir migration). Sur collision (deux
 * évènements du même intitulé sur le même service), ajoute un suffixe
 * numérique croissant plutôt que d'échouer.
 */
async function resolveUniqueSlug(orgId: number, serviceId: number, base: string): Promise<string> {
  const root = slugify(base) || 'evenement'
  let candidate = root
  let suffix = 2
  while (await Event.query().where('orgId', orgId).where('serviceId', serviceId).where('slug', candidate).first()) {
    candidate = `${root}-${suffix}`
    suffix += 1
  }
  return candidate
}

function isAgentRequest(internalAuth: HttpContext['internalAuth']): boolean {
  return internalAuth.role !== undefined || internalAuth.servicePermissions !== undefined
}

function serializeEventForAgent(event: Event) {
  return {
    id: event.id,
    slug: event.slug,
    type: event.type,
    title: event.title,
    description: event.description,
    eventDate: event.eventDate?.toISODate() ?? null,
    startTime: event.startTime,
    endTime: event.endTime,
    timeLabel: event.timeLabel,
    location: event.location,
    category: event.category,
    registrationDeadline: event.registrationDeadline?.toISO() ?? null,
    priceCents: event.priceCents,
    requiresDocuments: event.requiresDocuments,
    documentInstructions: event.documentInstructions,
    capacity: event.capacity,
    maxParticipantsPerRegistration: event.maxParticipantsPerRegistration,
    formSchema: event.formSchema,
    status: event.status,
    createdAt: event.createdAt.toISO(),
  }
}

async function serializeEventForCitizen(event: Event) {
  const seatsHeld = await computeSeatsHeld(event.id)
  const seatsRemaining = event.capacity === null ? null : Math.max(event.capacity - seatsHeld, 0)

  return {
    id: event.id,
    slug: event.slug,
    type: event.type,
    title: event.title,
    description: event.description,
    eventDate: event.eventDate?.toISODate() ?? null,
    startTime: event.startTime,
    endTime: event.endTime,
    timeLabel: event.timeLabel,
    location: event.location,
    category: event.category,
    registrationDeadline: event.registrationDeadline?.toISO() ?? null,
    priceCents: event.priceCents,
    requiresDocuments: event.requiresDocuments,
    documentInstructions: event.documentInstructions,
    capacity: event.capacity,
    maxParticipantsPerRegistration: event.maxParticipantsPerRegistration,
    formSchema: event.formSchema,
    // Illimité (capacity === null) : jamais complet, jamais de badge liste
    // d'attente côté front.
    seatsRemaining,
    isFull: seatsRemaining !== null && seatsRemaining <= 0,
  }
}

export default class EventsController {
  /**
   * GET /events?serviceId= — même route pour le catalogue citoyen
   * (published + non expirés uniquement) et la vue de gestion agent (tous
   * statuts, réservée à canManageTariffs) — distingués par la présence de
   * `role`/`servicePermissions` dans le JWT interne, exactement comme
   * TariffsController#index côté svc-billetterie.
   */
  async index(ctx: HttpContext) {
    const { orgId, role, servicePermissions } = ctx.internalAuth

    if (isAgentRequest(ctx.internalAuth)) {
      const { serviceId } = await ctx.request.validateUsing(listEventsAgentValidator)

      if (role !== 'admin' && !servicePermissions?.[String(serviceId)]?.canManageTariffs) {
        return ctx.response.status(403).send({ error: 'permission_required' })
      }

      const events = await Event.query()
        .where('orgId', orgId)
        .where('serviceId', serviceId)
        .orderBy('createdAt', 'desc')

      return ctx.response.send({ data: events.map(serializeEventForAgent) })
    }

    const { serviceId } = await publicListValidator.validate(ctx.request.qs())

    const events = await Event.query()
      .where('orgId', orgId)
      .where('serviceId', serviceId)
      .where('status', 'published')
      .where((sub) => {
        sub.whereNull('registrationDeadline').orWhere('registrationDeadline', '>=', DateTime.now().toSQL()!)
      })
      .orderBy('eventDate', 'asc')

    return ctx.response.send({ data: await Promise.all(events.map(serializeEventForCitizen)) })
  }

  /**
   * GET /events/:id — public si l'évènement est `published`, sinon
   * réservé à un agent avec `canManageTariffs` sur son service (aperçu
   * d'un évènement en brouillon avant publication). Utilisé côté agent
   * (id numérique connu depuis la liste de gestion) ; côté citoyen, voir
   * showBySlug.
   */
  async show(ctx: HttpContext) {
    const { orgId, role, servicePermissions } = ctx.internalAuth

    const event = await Event.query().where('id', Number(ctx.params.id)).where('orgId', orgId).first()
    if (!event) {
      return ctx.response.status(404).send({ error: 'event_not_found' })
    }

    if (event.status !== 'published') {
      const canManage = role === 'admin' || servicePermissions?.[String(event.serviceId)]?.canManageTariffs
      if (!canManage) {
        return ctx.response.status(404).send({ error: 'event_not_found' })
      }
      return ctx.response.send({ data: serializeEventForAgent(event) })
    }

    return ctx.response.send({ data: await serializeEventForCitizen(event) })
  }

  /**
   * GET /events/by-slug/:slug?serviceId= — entrée citoyen (liens/QR,
   * catalogue). `serviceId` nécessaire : le slug n'est unique que par
   * (orgId, serviceId), jamais globalement.
   */
  async showBySlug(ctx: HttpContext) {
    const { orgId } = ctx.internalAuth
    const { serviceId } = await publicBySlugValidator.validate(ctx.request.qs())

    const event = await Event.query()
      .where('slug', ctx.params.slug)
      .where('orgId', orgId)
      .where('serviceId', serviceId)
      .where('status', 'published')
      .first()
    if (!event) {
      return ctx.response.status(404).send({ error: 'event_not_found' })
    }

    return ctx.response.send({ data: await serializeEventForCitizen(event) })
  }

  /**
   * POST /services/:id/events — création d'un évènement/formation par
   * l'agent gestionnaire du service.
   */
  async store(ctx: HttpContext) {
    const { orgId, role, servicePermissions, serviceIds } = ctx.internalAuth
    const serviceId = Number(ctx.params.id)

    if (!serviceIds?.includes(serviceId)) {
      return ctx.response.status(403).send({ error: 'service_not_allowed_for_agent' })
    }
    if (role !== 'admin' && !servicePermissions?.[String(serviceId)]?.canManageTariffs) {
      return ctx.response.status(403).send({ error: 'permission_required' })
    }

    const payload = await ctx.request.validateUsing(createEventValidator)

    if (payload.slug) {
      const collision = await Event.query()
        .where('orgId', orgId)
        .where('serviceId', serviceId)
        .where('slug', payload.slug)
        .first()
      if (collision) return ctx.response.status(409).send({ error: 'slug_already_used' })
    }
    const slug = payload.slug ?? (await resolveUniqueSlug(Number(orgId), serviceId, payload.title))

    const event = await Event.create({
      orgId: Number(orgId),
      serviceId,
      type: payload.type,
      slug,
      title: payload.title,
      description: payload.description ?? null,
      eventDate: payload.eventDate ?? null,
      startTime: payload.startTime ?? null,
      endTime: payload.endTime ?? null,
      timeLabel: payload.timeLabel ?? null,
      location: payload.location ?? null,
      category: payload.category ?? null,
      registrationDeadline: payload.registrationDeadline ?? null,
      priceCents: payload.priceCents,
      requiresDocuments: payload.requiresDocuments,
      documentInstructions: payload.documentInstructions ?? null,
      capacity: payload.capacity ?? null,
      maxParticipantsPerRegistration: payload.maxParticipantsPerRegistration ?? 1,
      formSchema: payload.formSchema ?? null,
      status: payload.status ?? 'draft',
    })

    return ctx.response.status(201).send({ data: serializeEventForAgent(event) })
  }

  /**
   * PATCH /events/:id — mise à jour partielle (voir updateEventValidator :
   * null retire un champ optionnel, undefined ne le touche pas). Le slug
   * n'est modifiable qu'explicitement (jamais recalculé depuis `title`).
   */
  async update(ctx: HttpContext) {
    const { orgId, role, servicePermissions, serviceIds } = ctx.internalAuth

    const event = await Event.query().where('id', Number(ctx.params.id)).where('orgId', orgId).first()
    if (!event) {
      return ctx.response.status(404).send({ error: 'event_not_found' })
    }

    if (!serviceIds?.includes(event.serviceId)) {
      return ctx.response.status(403).send({ error: 'service_not_allowed_for_agent' })
    }
    if (role !== 'admin' && !servicePermissions?.[String(event.serviceId)]?.canManageTariffs) {
      return ctx.response.status(403).send({ error: 'permission_required' })
    }

    const payload = await ctx.request.validateUsing(updateEventValidator)

    if (payload.slug !== undefined && payload.slug !== event.slug) {
      const collision = await Event.query()
        .where('orgId', orgId)
        .where('serviceId', event.serviceId)
        .where('slug', payload.slug)
        .whereNot('id', event.id)
        .first()
      if (collision) return ctx.response.status(409).send({ error: 'slug_already_used' })
      event.slug = payload.slug
    }
    if (payload.type !== undefined) event.type = payload.type
    if (payload.title !== undefined) event.title = payload.title
    if (payload.description !== undefined) event.description = payload.description
    if (payload.eventDate !== undefined) event.eventDate = payload.eventDate
    if (payload.startTime !== undefined) event.startTime = payload.startTime
    if (payload.endTime !== undefined) event.endTime = payload.endTime
    if (payload.timeLabel !== undefined) event.timeLabel = payload.timeLabel
    if (payload.location !== undefined) event.location = payload.location
    if (payload.category !== undefined) event.category = payload.category
    if (payload.registrationDeadline !== undefined) event.registrationDeadline = payload.registrationDeadline
    if (payload.priceCents !== undefined) event.priceCents = payload.priceCents
    if (payload.requiresDocuments !== undefined) event.requiresDocuments = payload.requiresDocuments
    if (payload.documentInstructions !== undefined) event.documentInstructions = payload.documentInstructions
    if (payload.capacity !== undefined) event.capacity = payload.capacity
    if (payload.maxParticipantsPerRegistration !== undefined) {
      event.maxParticipantsPerRegistration = payload.maxParticipantsPerRegistration
    }
    if (payload.formSchema !== undefined) event.formSchema = payload.formSchema
    if (payload.status !== undefined) event.status = payload.status

    await event.save()

    return ctx.response.send({ data: serializeEventForAgent(event) })
  }

  /**
   * DELETE /events/:id — suppression définitive, réservée à un évènement
   * déjà `archived` — jamais un évènement encore visible/actif qui
   * pourrait avoir des inscriptions en cours. Les inscriptions existantes
   * gardent leur propre copie du prix (priceCentsAtRegistration) mais
   * référencent toujours eventId : voir la contrainte FK sans CASCADE sur
   * `registrations.event_id`, qui refusera la suppression tant qu'il
   * existe des inscriptions pour cet évènement — cohérent avec
   * "jamais une cascade silencieuse" (voir migration).
   */
  async destroy(ctx: HttpContext) {
    const { orgId, role, servicePermissions, serviceIds } = ctx.internalAuth

    const event = await Event.query().where('id', Number(ctx.params.id)).where('orgId', orgId).first()
    if (!event) {
      return ctx.response.status(404).send({ error: 'event_not_found' })
    }

    if (!serviceIds?.includes(event.serviceId)) {
      return ctx.response.status(403).send({ error: 'service_not_allowed_for_agent' })
    }
    if (role !== 'admin' && !servicePermissions?.[String(event.serviceId)]?.canManageTariffs) {
      return ctx.response.status(403).send({ error: 'permission_required' })
    }

    if (event.status !== 'archived') {
      return ctx.response.status(409).send({ error: 'event_must_be_archived_first' })
    }

    // La FK registrations.event_id n'a pas de CASCADE (voir migration) —
    // vérifié ici pour renvoyer une erreur métier claire plutôt que de
    // laisser Postgres rejeter la requête avec une contrainte violée.
    const hasRegistrations = await Registration.query().where('eventId', event.id).first()
    if (hasRegistrations) {
      return ctx.response.status(409).send({ error: 'event_has_registrations' })
    }

    await event.delete()

    return ctx.response.status(204).send('')
  }
}
