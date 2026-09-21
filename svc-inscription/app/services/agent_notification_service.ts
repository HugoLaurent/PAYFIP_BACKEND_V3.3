import { DateTime } from 'luxon'
import AgentNotification, { type AgentNotificationType } from '#models/agent_notification'
import type Registration from '#models/registration'
import type Event from '#models/event'

/**
 * Journalise un événement notifiable à l'agent — jamais bloquant pour
 * l'appelant (une notification manquée ne doit jamais faire échouer
 * l'action citoyenne qui l'a déclenchée), voir les appelants dans
 * registrations_controller.ts / registration_expiry_service.ts.
 */
export async function notifyAgent(
  type: AgentNotificationType,
  registration: Registration,
  event: Pick<Event, 'title'>
): Promise<void> {
  await AgentNotification.create({
    orgId: registration.orgId,
    serviceId: registration.serviceId,
    eventId: registration.eventId,
    registrationId: registration.id,
    type,
    citizenName: `${registration.firstName} ${registration.lastName}`.trim(),
    eventTitle: event.title,
  })
}

const RECENT_LIMIT = 30

export interface AgentNotificationSummary {
  id: number
  type: AgentNotificationType
  citizenName: string
  eventTitle: string
  eventId: number
  serviceId: number
  createdAt: string
}

/**
 * Un seul service à la fois (base tenant, voir runOnTenant) — l'appelant
 * fait le fan-out sur les services de l'agent, même pattern que
 * pendingReviewCount côté events_controller.ts.
 */
export async function getUnreadNotifications(
  orgId: string,
  serviceId: number
): Promise<AgentNotificationSummary[]> {
  const unread = await AgentNotification.query()
    .where('orgId', orgId)
    .where('serviceId', serviceId)
    .whereNull('readAt')
    .orderBy('createdAt', 'desc')
    .limit(RECENT_LIMIT)

  return unread.map((n) => ({
    id: n.id,
    type: n.type,
    citizenName: n.citizenName,
    eventTitle: n.eventTitle,
    eventId: n.eventId,
    serviceId: n.serviceId,
    createdAt: n.createdAt.toISO()!,
  }))
}

export async function markNotificationsRead(
  orgId: string,
  serviceId: number,
  ids: number[]
): Promise<void> {
  await AgentNotification.query()
    .where('orgId', orgId)
    .where('serviceId', serviceId)
    .whereIn('id', ids)
    .whereNull('readAt')
    .update({ readAt: DateTime.now().toSQL() })
}
