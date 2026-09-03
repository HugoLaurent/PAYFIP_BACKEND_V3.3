import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import EmailDelivery from '#models/email_delivery'
import { listEmailsStaffValidator } from '#validators/staff'
import { renderMailTemplate, type MailTemplateName } from '#services/mail_template_registry'

// Mêmes serviceId que le seed démo svc-auth (org "AREGIE Demo Mixte") — les
// 4 services y ont réellement un logo uploadé, voir POST /auth/services/:id/logo.
function logoUrlFor(serviceId: number): string | undefined {
  const base = env.get('PAYFIP_PUBLIC_BASE_URL')
  return base ? `${base}/services/${serviceId}/logo` : undefined
}

// Données factices mais réalistes, pour le mode démo (page front
// /demo/emails) — un exemple par template présentable à un client, jamais
// tirées d'un EmailDelivery réel : disponibles même si aucun envoi n'a
// encore eu lieu sur ce déploiement. inscription_agent_review_needed en est
// volontairement absent — notification interne à l'organisme, pas un email
// que voit le citoyen, hors du propos d'une démo commerciale.
const EXAMPLE_EMAIL_DATA: Partial<Record<MailTemplateName, Record<string, unknown>>> = {
  otp_code: {
    code: '482913',
    ttlMinutes: 10,
  },
  ticket_confirmation: {
    email: 'jean.dupont@example.test',
    confirmation: 'BILL00000100000042',
    visitDate: '15 septembre 2026',
    billetsSummary: '2 × Adulte, 1 × Enfant',
    totalAmountCents: 4500,
    serviceName: 'Piscine Municipale A',
    orgName: 'AREGIE Demo Mixte',
    logoUrl: logoUrlFor(1),
  },
  invoice_confirmation: {
    confirmation: 'FACT00000300000012',
    objectLabel: 'Frais de séjour — chambre 204',
    amountCents: 18750,
    clientNumber: '006272-00042',
    serviceName: 'Facturation Hôpital',
    orgName: 'AREGIE Demo Mixte',
    logoUrl: logoUrlFor(3),
  },
  inscription_confirmation: {
    email: 'jean.dupont@example.test',
    eventTitle: 'Atelier E2E',
    eventDate: '20 septembre 2026',
    eventLocation: 'Salle municipale',
    quantity: 1,
    amountCents: 0,
    registrationNumber: 'INSC00000600000042',
    serviceName: 'Inscriptions Formations',
    orgName: 'AREGIE Demo Mixte',
    logoUrl: logoUrlFor(6),
  },
  inscription_payment_request: {
    email: 'jean.dupont@example.test',
    eventTitle: 'Formation avec justificatif',
    amountCents: 3500,
    payUrl: 'https://demo.payfip.fr/inscription/inscriptions-formations/retour?accessToken=exemple',
    serviceName: 'Inscriptions Formations',
    orgName: 'AREGIE Demo Mixte',
    logoUrl: logoUrlFor(6),
  },
  inscription_registration_rejected: {
    email: 'jean.dupont@example.test',
    eventTitle: 'Formation avec justificatif',
    rejectionReason: 'Le justificatif fourni est illisible, merci d\'en déposer un nouveau.',
    documentDeadlineAt: '25 septembre 2026',
    redepositUrl: 'https://demo.payfip.fr/inscription/inscriptions-formations/retour?accessToken=exemple',
    serviceName: 'Inscriptions Formations',
    orgName: 'AREGIE Demo Mixte',
    logoUrl: logoUrlFor(6),
  },
  inscription_waitlist_offer: {
    email: 'jean.dupont@example.test',
    eventTitle: 'Complet — liste d\'attente',
    waitlistResponseDeadline: '18 septembre 2026 à 18h',
    confirmUrl: 'https://demo.payfip.fr/inscription/inscriptions-formations/retour?accessToken=exemple',
    serviceName: 'Inscriptions Formations',
    orgName: 'AREGIE Demo Mixte',
    logoUrl: logoUrlFor(6),
  },
  inscription_event_cancelled: {
    email: 'jean.dupont@example.test',
    eventTitle: 'Atelier E2E',
    eventDate: '20 septembre 2026',
    wasPaid: true,
    amountCents: 3500,
    serviceName: 'Inscriptions Formations',
    orgName: 'AREGIE Demo Mixte',
    logoUrl: logoUrlFor(6),
  },
}

export default class StaffController {
  async index(ctx: HttpContext) {
    if (ctx.internalAuth.scope !== 'staff') {
      return ctx.response.status(403).send({ error: 'scope_not_allowed' })
    }

    const { status, q, dateFrom, dateTo, page, perPage } = await ctx.request.validateUsing(
      listEmailsStaffValidator
    )

    const query = EmailDelivery.query().orderBy('id', 'desc')
    if (status) query.where('status', status)
    if (q) query.whereLike('toEmail', `%${q}%`)
    if (dateFrom) query.where('createdAt', '>=', dateFrom.toJSDate())
    if (dateTo) query.where('createdAt', '<=', dateTo.plus({ days: 1 }).toJSDate())

    const deliveries = await query.paginate(page ?? 1, perPage ?? 25)

    return ctx.response.send({
      data: deliveries.all().map((d) => ({
        id: d.id,
        template: d.template,
        toEmail: d.toEmail,
        status: d.status,
        attempts: d.attempts,
        error: d.error,
        createdAt: d.createdAt.toISO(),
        sentAt: d.sentAt?.toISO() ?? null,
      })),
      meta: deliveries.getMeta(),
    })
  }

  /**
   * GET /emails/staff/:id — contenu rendu d'un envoi (sujet/HTML), pour la
   * page de prévisualisation staff. `template` est toujours une valeur de
   * MAIL_TEMPLATE_NAMES à l'écriture (sendEmailValidator) — cast sûr.
   */
  async show(ctx: HttpContext) {
    if (ctx.internalAuth.scope !== 'staff') {
      return ctx.response.status(403).send({ error: 'scope_not_allowed' })
    }

    const delivery = await EmailDelivery.find(Number(ctx.params.id))
    if (!delivery) {
      return ctx.response.status(404).send({ error: 'email_not_found' })
    }

    const rendered = await renderMailTemplate(delivery.template as MailTemplateName, delivery.data)

    return ctx.response.send({
      data: {
        id: delivery.id,
        template: delivery.template,
        toEmail: delivery.toEmail,
        status: delivery.status,
        subject: rendered.subject,
        html: rendered.html,
      },
    })
  }

  /**
   * GET /emails/example?template=... — rendu d'un exemple factice, pour le
   * widget de démo (montrer "à quoi ressemble un email" sans dépendre d'un
   * envoi réel déjà survenu). Même garde `scope === 'staff'` que le reste :
   * le widget passe par demo_controller.ts côté gateway, qui mint ce même
   * scope, jamais un scope dédié de plus à faire vivre.
   */
  async example(ctx: HttpContext) {
    if (ctx.internalAuth.scope !== 'staff') {
      return ctx.response.status(403).send({ error: 'scope_not_allowed' })
    }

    const template = ctx.request.qs().template as MailTemplateName
    const data = EXAMPLE_EMAIL_DATA[template]
    if (!data) {
      return ctx.response.status(404).send({ error: 'no_example_for_template' })
    }

    const rendered = await renderMailTemplate(template, data)

    return ctx.response.send({
      data: { template, subject: rendered.subject, html: rendered.html },
    })
  }
}
