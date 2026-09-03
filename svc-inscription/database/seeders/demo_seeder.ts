import { DateTime } from 'luxon'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Event from '#models/event'
import { runOnTenant } from '#services/tenant_connection_service'

// orgId/serviceId doivent correspondre au seed svc-auth (demo_seeder.ts, org
// "AREGIE Demo Mixte", service "Inscriptions Formations"). Jamais destiné à
// tourner ailleurs qu'en dev/démo. Event vit dans la base tenant du service
// (voir tenant_base_model.ts) : toute écriture doit passer par
// runOnTenant(), jamais un firstOrCreate/updateOrCreate nu — oubli présent
// dans une version antérieure de ce fichier, qui aurait levé
// tenant_connection_not_set au premier lancement réel.
const ORG_ID = 1
const SERVICE_ID = 6

export default class extends BaseSeeder {
  async run() {
    await runOnTenant(SERVICE_ID, async () => {
      const swim = await Event.updateOrCreate(
        { orgId: ORG_ID, serviceId: SERVICE_ID, slug: 'natation-adultes-debutant' },
        {
          orgId: ORG_ID,
          serviceId: SERVICE_ID,
          slug: 'natation-adultes-debutant',
          type: 'formation',
          category: 'Sport',
          title: 'Natation adultes — niveau débutant',
          description:
            "Dix séances d'une heure pour apprendre ou reprendre confiance dans l'eau, encadrées par un maître-nageur. Petit groupe, tous niveaux acceptés.",
          eventDate: DateTime.now().plus({ days: 12 }),
          timeLabel: 'Mardis 18h30 – 19h30',
          location: 'Piscine Municipale A',
          priceCents: 4500,
          capacity: 12,
          maxParticipantsPerRegistration: 1,
          status: 'published',
        }
      )

      const firstAid = await Event.updateOrCreate(
        { orgId: ORG_ID, serviceId: SERVICE_ID, slug: 'premiers-secours-psc1' },
        {
          orgId: ORG_ID,
          serviceId: SERVICE_ID,
          slug: 'premiers-secours-psc1',
          type: 'formation',
          category: 'Santé',
          title: 'Premiers secours — PSC1',
          description:
            'Formation certifiante aux gestes qui sauvent, une journée complète. Un certificat médical de non contre-indication est demandé à l’inscription.',
          eventDate: DateTime.now().plus({ days: 21 }),
          timeLabel: '9h – 17h',
          location: 'Salle municipale',
          priceCents: 3500,
          capacity: 10,
          maxParticipantsPerRegistration: 1,
          status: 'published',
          documentRequirements: [
            {
              key: 'certificat_medical',
              label: 'Certificat médical',
              instructions: 'De moins de 3 mois, attestant l’absence de contre-indication.',
              required: true,
            },
          ],
        }
      )

      const townHall = await Event.updateOrCreate(
        { orgId: ORG_ID, serviceId: SERVICE_ID, slug: 'reunion-publique-mediatheque' },
        {
          orgId: ORG_ID,
          serviceId: SERVICE_ID,
          slug: 'reunion-publique-mediatheque',
          type: 'evenement',
          category: 'Citoyenneté',
          title: 'Réunion publique — projet de médiathèque',
          description:
            "Présentation du projet de médiathèque par l'équipe municipale, suivie d'un temps d'échange avec les habitants. Ouvert à tous, entrée libre.",
          eventDate: DateTime.now().plus({ days: 9 }),
          timeLabel: '18h30 – 20h',
          location: 'Salle du conseil',
          priceCents: 0,
          capacity: null,
          maxParticipantsPerRegistration: 6,
          status: 'published',
        }
      )

      const computerWorkshop = await Event.updateOrCreate(
        { orgId: ORG_ID, serviceId: SERVICE_ID, slug: 'atelier-informatique-seniors' },
        {
          orgId: ORG_ID,
          serviceId: SERVICE_ID,
          slug: 'atelier-informatique-seniors',
          type: 'formation',
          category: 'Numérique',
          title: 'Atelier informatique — seniors',
          description:
            'Prise en main du courrier électronique et des démarches administratives en ligne. Séance unique, gratuite, place unique pour illustrer la liste d’attente en démo.',
          eventDate: DateTime.now().plus({ days: 6 }),
          timeLabel: '14h – 16h',
          location: 'Médiathèque',
          priceCents: 0,
          capacity: 1,
          maxParticipantsPerRegistration: 1,
          status: 'published',
          formSchema: [
            {
              key: 'deja_utilise_ordinateur',
              label: 'Avez-vous déjà utilisé un ordinateur ?',
              type: 'choice',
              required: true,
              options: ['Oui', 'Non'],
            },
          ],
        }
      )

      const choir = await Event.updateOrCreate(
        { orgId: ORG_ID, serviceId: SERVICE_ID, slug: 'concert-choeur-municipal' },
        {
          orgId: ORG_ID,
          serviceId: SERVICE_ID,
          slug: 'concert-choeur-municipal',
          type: 'evenement',
          category: 'Culture',
          title: 'Concert de fin d’année — chœur municipal',
          description: 'Le chœur municipal clôture sa saison avec un répertoire de chants populaires. Entrée gratuite, dans la limite des places disponibles.',
          eventDate: DateTime.now().plus({ days: 30 }),
          timeLabel: '20h30',
          location: 'Salle des fêtes',
          priceCents: 0,
          capacity: 80,
          maxParticipantsPerRegistration: 8,
          status: 'published',
        }
      )

      console.log('--- Seed OK (svc-inscription) ---')
      for (const e of [swim, firstAid, townHall, computerWorkshop, choir]) {
        console.log(`${e.title} — ${e.slug}`)
      }
    })
  }
}
