import { DateTime } from 'luxon'

export interface OpeningSchedule {
  openingDays: number[] | null
  openingStartTime: string | null
  openingEndTime: string | null
}

export interface ClosurePeriod {
  label: string
  startDate: DateTime
  endDate: DateTime
}

export interface ServiceAvailability {
  isOpen: boolean
  reopensAt: string | null
  closedReason: string | null
}

// Seule source de vérité pour "ce service est-il ouvert maintenant" —
// utilisée à la fois par le lookup public (afficher l'écran "Fermé"),
// l'endpoint pair-à-pair appelé par svc-billetterie (bloquer la commande),
// et la fiche admin. Une période de fermeture explicite prime toujours sur
// les horaires hebdomadaires, même un jour/heure normalement ouvert.
//
// `ignoreWeeklySchedule` : la billetterie vend des billets pour une DATE DE
// VISITE, pas pour "maintenant" — fermer récurremment le mardi ne doit
// jamais bloquer la page d'achat elle-même (un usager doit pouvoir acheter
// un mardi un billet pour samedi), seulement empêcher de choisir un mardi
// comme date de visite (voir isWeekdayOpen ci-dessous, utilisé côté
// svc-billetterie). Les fermetures ponctuelles (closures), elles, bloquent
// toujours la page dans les deux cas — une vraie fermeture, pas un jour
// récurrent.
export function computeServiceAvailability(
  schedule: OpeningSchedule,
  closures: ClosurePeriod[],
  now: DateTime = DateTime.now(),
  options: { ignoreWeeklySchedule?: boolean } = {}
): ServiceAvailability {
  const activeClosure = closures.find(
    (c) => now >= c.startDate.startOf('day') && now <= c.endDate.endOf('day')
  )
  if (activeClosure) {
    return {
      isOpen: false,
      reopensAt: nextOpeningAfter(
        activeClosure.endDate.plus({ days: 1 }).startOf('day'),
        schedule,
        closures
      ),
      closedReason: activeClosure.label,
    }
  }

  if (options.ignoreWeeklySchedule) {
    return { isOpen: true, reopensAt: null, closedReason: null }
  }

  const hasWeeklySchedule =
    schedule.openingDays !== null &&
    schedule.openingStartTime !== null &&
    schedule.openingEndTime !== null

  // Pas d'horaires hebdo configurés : le service reste ouvert en
  // permanence (comportement historique) — seules les périodes de
  // fermeture explicites, déjà traitées ci-dessus, peuvent fermer un
  // service sans horaires.
  if (!hasWeeklySchedule) {
    return { isOpen: true, reopensAt: null, closedReason: null }
  }

  const [startH, startM] = schedule.openingStartTime!.split(':').map(Number)
  const [endH, endM] = schedule.openingEndTime!.split(':').map(Number)
  const opensAt = now.set({ hour: startH, minute: startM, second: 0, millisecond: 0 })
  const closesAt = now.set({ hour: endH, minute: endM, second: 0, millisecond: 0 })

  const isOpen = schedule.openingDays!.includes(now.weekday) && now >= opensAt && now <= closesAt
  if (isOpen) {
    return { isOpen: true, reopensAt: null, closedReason: null }
  }

  return { isOpen: false, reopensAt: nextOpeningAfter(now, schedule, closures), closedReason: null }
}

// Une date de visite (billetterie) tombe-t-elle un jour ouvert ? Pas
// d'horaires ici (voir plus haut) — seul le jour de la semaine compte.
// `openingDays` null = pas de restriction, tous les jours conviennent.
export function isWeekdayOpen(openingDays: number[] | null, isoDate: string): boolean {
  if (!openingDays) return true
  const weekday = DateTime.fromISO(isoDate).weekday
  return openingDays.includes(weekday)
}

// Cherche le prochain créneau d'ouverture à partir de `from`, en sautant
// les jours non ouvrés ET les jours couverts par une période de fermeture
// — borné à 400 jours pour ne jamais boucler indéfiniment sur une
// configuration incohérente (ex. aucun jour coché).
function nextOpeningAfter(
  from: DateTime,
  schedule: OpeningSchedule,
  closures: ClosurePeriod[]
): string | null {
  if (!schedule.openingDays?.length || !schedule.openingStartTime) return null
  const [startH, startM] = schedule.openingStartTime.split(':').map(Number)

  for (let i = 0; i < 400; i++) {
    const day = from.plus({ days: i }).startOf('day')
    const isClosureDay = closures.some(
      (c) => day >= c.startDate.startOf('day') && day <= c.endDate.endOf('day')
    )
    if (isClosureDay || !schedule.openingDays.includes(day.weekday)) continue

    const opensAt = day.set({ hour: startH, minute: startM, second: 0, millisecond: 0 })
    if (opensAt > from) return opensAt.toISO()
  }

  return null
}
