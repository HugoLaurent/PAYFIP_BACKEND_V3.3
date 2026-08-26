// Limiteur en mémoire par clé (IP, ou IP+contexte). Neutre sur ce qui est
// compté : `recordAttempt` peut être appelé sur chaque requête (ex. login,
// peu fréquent) ou seulement sur les échecs (ex. clé staff envoyée à
// chaque appel — compter tout appel bloquerait un usage légitime normal).
//
// La Gateway tourne en un seul conteneur : pas besoin d'un store partagé
// (Redis) pour l'instant. Si elle est un jour répliquée, ce compteur devra
// être déplacé vers un store commun.

const WINDOW_MS = 5 * 60 * 1000
const MAX_FAILURES = 10

const failures = new Map<string, number[]>()

export function isRateLimited(key: string): boolean {
  const windowStart = Date.now() - WINDOW_MS
  const timestamps = (failures.get(key) ?? []).filter((t) => t > windowStart)
  return timestamps.length >= MAX_FAILURES
}

// Secondes avant qu'une nouvelle tentative redevienne possible — le temps
// restant avant que la plus ancienne tentative de la fenêtre n'en sorte.
// Les tentatives sont poussées dans l'ordre chronologique, donc la première
// de la liste filtrée est la plus ancienne encore comptée.
export function retryAfterSeconds(key: string): number {
  const windowStart = Date.now() - WINDOW_MS
  const timestamps = (failures.get(key) ?? []).filter((t) => t > windowStart)
  const oldest = timestamps[0]
  if (oldest === undefined) return 0
  return Math.max(1, Math.ceil((oldest + WINDOW_MS - Date.now()) / 1000))
}

export function recordAttempt(key: string): void {
  const windowStart = Date.now() - WINDOW_MS
  const timestamps = (failures.get(key) ?? []).filter((t) => t > windowStart)
  timestamps.push(Date.now())
  failures.set(key, timestamps)
}

// Purge périodique pour ne pas accumuler indéfiniment des clés inactives.
setInterval(
  () => {
    const windowStart = Date.now() - WINDOW_MS
    for (const [key, timestamps] of failures) {
      const fresh = timestamps.filter((t) => t > windowStart)
      if (fresh.length === 0) failures.delete(key)
      else failures.set(key, fresh)
    }
  },
  WINDOW_MS
).unref()
