const DEFAULT_TIMEOUT_MS = 15_000

export function fetchWithTimeout(url: string | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS) })
}
