import { readFile } from 'node:fs/promises'
import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import Service from '#models/service'
import Organization from '#models/organization'
import UserServiceAssignment from '#models/user_service_assignment'
import { createServiceValidator, updateServiceValidator } from '#validators/service'
import { processCoverImage, processLogo } from '#services/image_processing_service'

const lookupValidator = vine.compile(
  vine.object({
    orgId: vine.number().positive(),
  })
)

const listValidator = vine.compile(
  vine.object({
    orgId: vine.number().positive().optional(),
    q: vine.string().trim().optional(),
    page: vine.number().positive().optional(),
    perPage: vine.number().positive().max(100).optional(),
  })
)

// Colonnes nécessaires à serializeService() — délibérément SANS logoData
// ni coverImageData : ces blobs binaires (parfois volumineux) n'ont rien
// à faire dans une liste ou une fiche service, seul le MIME type importe
// (pour dériver hasLogo/hasCoverImage).
const SERVICE_LIST_COLUMNS = [
  'id',
  'orgId',
  'name',
  'serviceType',
  'status',
  'numcli',
  'slug',
  'logoMimeType',
  'coverImageMimeType',
] as const

function serializeService(s: Service) {
  return {
    id: s.id,
    orgId: s.orgId,
    name: s.name,
    serviceType: s.serviceType,
    status: s.status,
    numcli: s.numcli,
    slug: s.slug,
    hasLogo: s.logoMimeType !== null,
    hasCoverImage: s.coverImageMimeType !== null,
  }
}

// Partagées entre logo et image de couverture — mêmes règles de
// validation (taille, extensions, MIME détecté par magic bytes).
const IMAGE_MAX_SIZE = '1.5mb'
const IMAGE_EXTNAMES = ['png', 'jpg', 'jpeg', 'svg']
const IMAGE_ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml']

const COMBINING_DIACRITICS = new RegExp('[̀-ͯ]', 'g')

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default class ServicesController {
  async index(ctx: HttpContext) {
    const { scope, role, sub, orgId } = ctx.internalAuth
    const { orgId: filterOrgId, q, page, perPage } = await ctx.request.validateUsing(listValidator)

    if (scope === 'staff') {
      const query = Service.query().select(...SERVICE_LIST_COLUMNS).orderBy('id', 'desc')
      if (filterOrgId) query.where('orgId', filterOrgId)
      if (q) query.whereILike('name', `%${q}%`)
      const services = await query.paginate(page ?? 1, perPage ?? 25)
      return ctx.response.send({ data: services.all().map(serializeService), meta: services.getMeta() })
    }

    if (role === 'admin') {
      const query = Service.query()
        .select(...SERVICE_LIST_COLUMNS)
        .where('orgId', Number(orgId))
        .orderBy('id', 'desc')
      if (q) query.whereILike('name', `%${q}%`)
      const services = await query.paginate(page ?? 1, perPage ?? 25)
      return ctx.response.send({ data: services.all().map(serializeService), meta: services.getMeta() })
    }

    if (role === 'agent' && sub) {
      const assignments = await UserServiceAssignment.query().where('userId', Number(sub))
      const serviceIds = assignments.map((a) => a.serviceId)
      const query = Service.query()
        .select(...SERVICE_LIST_COLUMNS)
        .where('orgId', Number(orgId))
        .orderBy('id', 'desc')
      if (serviceIds.length) {
        query.whereIn('id', serviceIds)
      } else {
        query.whereRaw('1 = 0')
      }
      if (q) query.whereILike('name', `%${q}%`)
      const services = await query.paginate(page ?? 1, perPage ?? 25)
      return ctx.response.send({ data: services.all().map(serializeService), meta: services.getMeta() })
    }

    return ctx.response.status(403).send({ error: 'scope_not_allowed' })
  }

  /**
   * GET /services/:id — une fiche service. Nécessaire pour un lien
   * profond côté front (React Router) : un rechargement de page ou un
   * lien partagé n'a que l'id dans l'URL, pas l'objet déjà chargé par la
   * liste. Mêmes règles de visibilité que index(), pour un seul service.
   */
  async show(ctx: HttpContext) {
    const { scope, role, sub, orgId } = ctx.internalAuth

    const service = await Service.query()
      .select(...SERVICE_LIST_COLUMNS)
      .where('id', Number(ctx.params.id))
      .first()
    if (!service) {
      return ctx.response.status(404).send({ error: 'service_not_found' })
    }

    if (scope === 'staff') {
      return ctx.response.send({ data: serializeService(service) })
    }

    if (String(service.orgId) !== orgId) {
      return ctx.response.status(404).send({ error: 'service_not_found' })
    }

    if (role === 'admin') {
      return ctx.response.send({ data: serializeService(service) })
    }

    if (role === 'agent' && sub) {
      const assignment = await UserServiceAssignment.query()
        .where('userId', Number(sub))
        .where('serviceId', service.id)
        .first()
      if (!assignment) {
        return ctx.response.status(403).send({ error: 'scope_not_allowed' })
      }
      return ctx.response.send({ data: serializeService(service) })
    }

    return ctx.response.status(403).send({ error: 'scope_not_allowed' })
  }

  async store(ctx: HttpContext) {
    if (ctx.internalAuth.scope !== 'staff') {
      return ctx.response.status(403).send({ error: 'scope_not_allowed' })
    }

    const organization = await Organization.find(Number(ctx.params.id))
    if (!organization) {
      return ctx.response.status(404).send({ error: 'organization_not_found' })
    }

    const payload = await ctx.request.validateUsing(createServiceValidator)

    const existingNumcli = await Service.findBy('numcli', payload.numcli)
    if (existingNumcli) {
      return ctx.response.status(409).send({ error: 'numcli_already_used' })
    }

    let slug = payload.slug ?? (payload.serviceType === 'billetterie' ? slugify(payload.name) : null)
    if (slug) {
      const existingSlug = await Service.findBy('slug', slug)
      if (existingSlug) {
        if (payload.slug) {
          return ctx.response.status(409).send({ error: 'slug_already_used' })
        }
        slug = `${slug}-${organization.id}`
      }
    }

    const service = await Service.create({
      orgId: organization.id,
      name: payload.name,
      serviceType: payload.serviceType,
      status: 'active',
      numcli: payload.numcli,
      saisieMode: payload.saisieMode ?? 'T',
      slug,
    })

    return ctx.response.status(201).send({
      data: {
        id: service.id,
        orgId: service.orgId,
        name: service.name,
        serviceType: service.serviceType,
        status: service.status,
        slug: service.slug,
      },
    })
  }

  /**
   * GET /services/lookup/:slug — public, non authentifié : c'est
   * justement le point d'entrée qui permet à un usager de naviguer
   * directement vers un service par une URL lisible, avant tout login.
   * Ne renvoie que des services actifs — un service archivé ou en
   * brouillon ne doit pas rester atteignable par un lien déjà partagé.
   */
  async lookupBySlug(ctx: HttpContext) {
    const service = await Service.query()
      .select('id', 'orgId', 'name', 'serviceType', 'status', 'slug')
      .where('slug', ctx.params.slug)
      .where('status', 'active')
      .first()

    if (!service) {
      return ctx.response.status(404).send({ error: 'service_not_found' })
    }

    return ctx.response.send({
      data: {
        orgId: service.orgId,
        serviceId: service.id,
        name: service.name,
        serviceType: service.serviceType,
      },
    })
  }

  /**
   * PATCH /services/:id — active/désactive UN service de SON organisme,
   * déjà provisionné par AREGIE. Créer un nouveau service reste
   * staff-only (voir store) : seul l'interrupteur appartient à
   * l'organisme. Un admin peut toujours ; un agent seulement s'il a le
   * droit "fermer les ventes" (canToggleService) SUR CE service précis.
   */
  async update(ctx: HttpContext) {
    const { orgId, role, servicePermissions } = ctx.internalAuth
    if (role !== 'admin' && !servicePermissions?.[ctx.params.id]?.canToggleService) {
      return ctx.response.status(403).send({ error: 'permission_required' })
    }

    const service = await Service.query()
      .where('id', Number(ctx.params.id))
      .where('orgId', Number(orgId))
      .first()

    if (!service) {
      return ctx.response.status(404).send({ error: 'service_not_found' })
    }

    const payload = await ctx.request.validateUsing(updateServiceValidator)
    service.status = payload.status
    await service.save()

    return ctx.response.send({
      data: { id: service.id, name: service.name, status: service.status },
    })
  }

  /**
   * GET /services/:id/payfip-account — résout la régie PayFiP d'un
   * service. Appelé exclusivement par svc-gestion (pair-à-pair) au moment
   * d'ouvrir une session de paiement : c'est la seule vérité sur "quel
   * numcli pour quel service", il n'existe plus de copie ailleurs.
   *
   * Ne tranche pas si le service est utilisable pour payer (statut actif
   * ou non) : c'est une lecture, la décision métier reste chez l'appelant.
   */
  async payfipAccount(ctx: HttpContext) {
    if (ctx.internalAuth.scope !== 'gestion') {
      return ctx.response.status(403).send({ error: 'scope_not_allowed' })
    }

    const { orgId } = await ctx.request.validateUsing(lookupValidator)

    const service = await Service.query()
      .where('id', Number(ctx.params.id))
      .where('orgId', orgId)
      .first()

    if (!service || !service.numcli) {
      return ctx.response.status(404).send({ error: 'no_payfip_account_for_service' })
    }

    return ctx.response.send({
      data: {
        numcli: service.numcli,
        saisieMode: service.saisieMode,
        status: service.status,
      },
    })
  }

  /**
   * GET /services/:id/status — pair-à-pair, appelé par svc-billetterie
   * juste avant d'accepter une commande (agent ou en ligne) : un service
   * fermé/archivé ne doit jamais laisser passer une vente, même si le
   * front a déjà masqué le bouton correspondant côté agent.
   */
  async status(ctx: HttpContext) {
    if (ctx.internalAuth.scope !== 'billetterie') {
      return ctx.response.status(403).send({ error: 'scope_not_allowed' })
    }

    const { orgId } = await ctx.request.validateUsing(lookupValidator)

    const service = await Service.query()
      .where('id', Number(ctx.params.id))
      .where('orgId', orgId)
      .first()

    if (!service) {
      return ctx.response.status(404).send({ error: 'service_not_found' })
    }

    return ctx.response.send({ data: { status: service.status } })
  }

  /**
   * GET /services/by-numcli/:numcli — résout l'organisme et le service à
   * partir d'un numcli. Appelé exclusivement par svc-billetterie et
   * svc-factures lors d'un dépôt AREGIE : AREGIE ne fournit qu'un numcli
   * dans chaque ligne (jamais un orgId directement), c'est à nous de
   * retrouver à qui il appartient — numcli est unique sur toute la base
   * (contrainte vérifiée dans store()), donc la résolution est sans
   * ambiguïté.
   */
  async byNumcli(ctx: HttpContext) {
    if (!['billetterie', 'factures'].includes(ctx.internalAuth.scope)) {
      return ctx.response.status(403).send({ error: 'scope_not_allowed' })
    }

    const service = await Service.findBy('numcli', ctx.params.numcli)
    if (!service) {
      return ctx.response.status(404).send({ error: 'numcli_not_found' })
    }

    return ctx.response.send({
      data: {
        orgId: service.orgId,
        serviceId: service.id,
        status: service.status,
        name: service.name,
      },
    })
  }

  /**
   * GET /services/:id/label — résout le nom d'affichage d'un service.
   * Appelé exclusivement par svc-factures (pair-à-pair), pour composer un
   * intitulé de facture générique ("Facture de {nom}") sans jamais
   * exposer au payeur le libellé réel déposé par AREGIE (potentiellement
   * une donnée de santé — type d'acte médical).
   */
  async label(ctx: HttpContext) {
    if (ctx.internalAuth.scope !== 'factures') {
      return ctx.response.status(403).send({ error: 'scope_not_allowed' })
    }

    const { orgId } = await ctx.request.validateUsing(lookupValidator)

    const service = await Service.query()
      .where('id', Number(ctx.params.id))
      .where('orgId', orgId)
      .first()

    if (!service) {
      return ctx.response.status(404).send({ error: 'service_not_found' })
    }

    return ctx.response.send({ data: { name: service.name } })
  }

  /**
   * POST /services/:id/logo — l'admin d'un organisme change le logo
   * d'un de SES services. Action de branding, pas d'exploitation : pas
   * d'exception agent contrairement à update() (toggle de statut).
   */
  async uploadLogo(ctx: HttpContext) {
    const { orgId, role } = ctx.internalAuth
    if (role !== 'admin') {
      return ctx.response.status(403).send({ error: 'permission_required' })
    }

    // On ne sélectionne pas les colonnes binaires (logo/couverture) : ce
    // fetch ne sert qu'à vérifier l'appartenance à l'organisme, on va de
    // toute façon écraser logoData juste après — pas la peine de faire
    // transiter l'éventuelle image de couverture (parfois volumineuse)
    // pour rien.
    const service = await Service.query()
      .select('id', 'orgId')
      .where('id', Number(ctx.params.id))
      .where('orgId', Number(orgId))
      .first()

    if (!service) {
      return ctx.response.status(404).send({ error: 'service_not_found' })
    }

    const file = ctx.request.file('logo', { size: IMAGE_MAX_SIZE, extnames: IMAGE_EXTNAMES })
    if (!file) {
      return ctx.response.status(400).send({ error: 'logo_required' })
    }
    if (!file.isValid) {
      return ctx.response.status(400).send({ error: 'invalid_logo', detail: file.errors })
    }

    // L'extension déclarée ne prouve rien : c'est le type MIME détecté par
    // le multipart-parser (magic bytes, pas le nom de fichier) qui compte
    // vraiment ici.
    const mimeType = `${file.type}/${file.subtype}`
    if (!IMAGE_ALLOWED_MIME_TYPES.includes(mimeType)) {
      return ctx.response.status(400).send({ error: 'invalid_logo', detail: 'unsupported_type' })
    }

    const original = await readFile(file.tmpPath!)
    const processed = await processLogo(original, mimeType)

    service.logoData = processed.data
    service.logoMimeType = processed.mimeType
    service.logoUpdatedAt = DateTime.now()
    await service.save()

    return ctx.response.send({
      data: { id: service.id, hasLogo: true, logoUpdatedAt: service.logoUpdatedAt.toISO() },
    })
  }

  /**
   * GET /services/:id/logo — public, sans jeton : c'est un <img src>
   * direct depuis le navigateur. Pas de filtre de statut/organisme, une
   * image de marque n'est pas une donnée sensible.
   */
  async showLogo(ctx: HttpContext) {
    // Ne charge que ce qui sert ici — sinon logoData ET coverImageData
    // (potentiellement lourde) transitent depuis Postgres à chaque
    // affichage du logo, pour rien.
    const service = await Service.query()
      .select('id', 'logoData', 'logoMimeType')
      .where('id', Number(ctx.params.id))
      .first()
    if (!service || !service.logoData || !service.logoMimeType) {
      return ctx.response.status(404).send({ error: 'logo_not_found' })
    }

    ctx.response.header('Content-Type', service.logoMimeType)
    ctx.response.header('Cache-Control', 'public, max-age=300')
    return ctx.response.send(service.logoData)
  }

  /**
   * POST /services/:id/cover — l'admin d'un organisme change l'image de
   * couverture d'un de SES services (bandeau affiché sur la page d'achat
   * citoyenne). Mêmes règles que uploadLogo, champ "cover" au lieu de
   * "logo".
   */
  async uploadCoverImage(ctx: HttpContext) {
    const { orgId, role } = ctx.internalAuth
    if (role !== 'admin') {
      return ctx.response.status(403).send({ error: 'permission_required' })
    }

    const service = await Service.query()
      .select('id', 'orgId')
      .where('id', Number(ctx.params.id))
      .where('orgId', Number(orgId))
      .first()

    if (!service) {
      return ctx.response.status(404).send({ error: 'service_not_found' })
    }

    const file = ctx.request.file('cover', { size: IMAGE_MAX_SIZE, extnames: IMAGE_EXTNAMES })
    if (!file) {
      return ctx.response.status(400).send({ error: 'cover_required' })
    }
    if (!file.isValid) {
      return ctx.response.status(400).send({ error: 'invalid_cover', detail: file.errors })
    }

    const mimeType = `${file.type}/${file.subtype}`
    if (!IMAGE_ALLOWED_MIME_TYPES.includes(mimeType)) {
      return ctx.response.status(400).send({ error: 'invalid_cover', detail: 'unsupported_type' })
    }

    const original = await readFile(file.tmpPath!)
    const processed = await processCoverImage(original, mimeType)

    service.coverImageData = processed.data
    service.coverImageMimeType = processed.mimeType
    service.coverImageUpdatedAt = DateTime.now()
    await service.save()

    return ctx.response.send({
      data: {
        id: service.id,
        hasCoverImage: true,
        coverImageUpdatedAt: service.coverImageUpdatedAt.toISO(),
      },
    })
  }

  /**
   * GET /services/:id/cover — public, sans jeton, même logique que
   * showLogo.
   */
  async showCoverImage(ctx: HttpContext) {
    const service = await Service.query()
      .select('id', 'coverImageData', 'coverImageMimeType')
      .where('id', Number(ctx.params.id))
      .first()
    if (!service || !service.coverImageData || !service.coverImageMimeType) {
      return ctx.response.status(404).send({ error: 'cover_not_found' })
    }

    ctx.response.header('Content-Type', service.coverImageMimeType)
    ctx.response.header('Cache-Control', 'public, max-age=300')
    return ctx.response.send(service.coverImageData)
  }

  /**
   * DELETE /services/:id/cover — l'admin retire l'image de couverture
   * d'un de SES services (retour à l'absence de bandeau sur la page
   * d'achat citoyenne).
   */
  async deleteCoverImage(ctx: HttpContext) {
    const { orgId, role } = ctx.internalAuth
    if (role !== 'admin') {
      return ctx.response.status(403).send({ error: 'permission_required' })
    }

    const service = await Service.query()
      .select('id', 'orgId')
      .where('id', Number(ctx.params.id))
      .where('orgId', Number(orgId))
      .first()

    if (!service) {
      return ctx.response.status(404).send({ error: 'service_not_found' })
    }

    service.coverImageData = null
    service.coverImageMimeType = null
    service.coverImageUpdatedAt = null
    await service.save()

    return ctx.response.send({ data: { id: service.id, hasCoverImage: false } })
  }
}
