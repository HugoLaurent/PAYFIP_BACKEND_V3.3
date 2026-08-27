/**
 * Libellé humain d'un agent au moment d'une revue de justificatifs — figé
 * sur l'inscription dès l'action, jamais recalculé plus tard : renommer ou
 * supprimer l'agent plus tard ne doit jamais réécrire "qui a fait quoi"
 * dans l'historique.
 */
export function agentLabel(identity: {
  agentEmail?: string | null
  agentFirstName?: string | null
  agentLastName?: string | null
}): string | null {
  const fullName = [identity.agentFirstName, identity.agentLastName].filter(Boolean).join(' ').trim()
  if (fullName) return fullName
  return identity.agentEmail ?? null
}
