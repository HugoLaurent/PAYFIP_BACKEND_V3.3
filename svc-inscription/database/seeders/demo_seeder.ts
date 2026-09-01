import { DateTime } from 'luxon'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Event from '#models/event'

// Données de test pour le dev local — orgId/serviceId doivent correspondre
// au seed svc-auth (démo_seeder.ts, org "AREGIE Demo Mixte", service
// "Inscriptions Formations"). Jamais destiné à tourner ailleurs qu'en dev.
const ORG_ID = 1
const SERVICE_ID = 6

export default class extends BaseSeeder {
  async run() {
    const free = await Event.firstOrCreate(
      { orgId: ORG_ID, serviceId: SERVICE_ID, slug: 'reunion-test' },
      {
        orgId: ORG_ID,
        serviceId: SERVICE_ID,
        slug: 'reunion-test',
        type: 'evenement',
        title: 'Réunion publique — test local',
        description: 'Évènement de test, gratuit, sans justificatif.',
        eventDate: DateTime.now().plus({ days: 14 }),
        timeLabel: '19h – 21h',
        location: 'Salle des fêtes',
        priceCents: 0,
        capacity: null,
        maxParticipantsPerRegistration: 4,
        status: 'published',
      }
    )

    const paid = await Event.firstOrCreate(
      { orgId: ORG_ID, serviceId: SERVICE_ID, slug: 'atelier-payant-test' },
      {
        orgId: ORG_ID,
        serviceId: SERVICE_ID,
        slug: 'atelier-payant-test',
        type: 'formation',
        title: 'Atelier payant — test local',
        description: 'Évènement de test, payant, sans justificatif (parcours B).',
        eventDate: DateTime.now().plus({ days: 10 }),
        timeLabel: '18h – 19h',
        location: 'Gymnase municipal',
        priceCents: 500,
        capacity: 30,
        maxParticipantsPerRegistration: 1,
        status: 'published',
      }
    )

    const withDocs = await Event.firstOrCreate(
      { orgId: ORG_ID, serviceId: SERVICE_ID, slug: 'formation-justificatif-test' },
      {
        orgId: ORG_ID,
        serviceId: SERVICE_ID,
        slug: 'formation-justificatif-test',
        type: 'formation',
        title: 'Formation avec justificatif — test local',
        description: 'Évènement de test, payant, avec justificatif (parcours C).',
        eventDate: DateTime.now().plus({ days: 20 }),
        timeLabel: '9h – 12h',
        location: 'Médiathèque',
        priceCents: 3399,
        capacity: 20,
        maxParticipantsPerRegistration: 1,
        status: 'published',
        documentRequirements: [
          { key: 'justificatif', label: 'Justificatif de domicile', required: true },
        ],
      }
    )

    const full = await Event.firstOrCreate(
      { orgId: ORG_ID, serviceId: SERVICE_ID, slug: 'complet-liste-attente-test' },
      {
        orgId: ORG_ID,
        serviceId: SERVICE_ID,
        slug: 'complet-liste-attente-test',
        type: 'evenement',
        title: 'Complet — test liste d\'attente',
        description: 'Capacité 1, pour tester la liste d\'attente (parcours D) dès la 2e inscription.',
        eventDate: DateTime.now().plus({ days: 7 }),
        timeLabel: '10h – 12h',
        location: 'Stade municipal',
        priceCents: 0,
        capacity: 1,
        maxParticipantsPerRegistration: 1,
        status: 'published',
      }
    )

    console.log('--- Seed OK (svc-inscription) ---')
    console.log(`Gratuit (parcours A) : ${free.slug}`)
    console.log(`Payant, sans justificatif (parcours B) : ${paid.slug}`)
    console.log(`Payant, avec justificatif (parcours C) : ${withDocs.slug}`)
    console.log(`Capacité 1, pour liste d'attente (parcours D) : ${full.slug}`)
  }
}
