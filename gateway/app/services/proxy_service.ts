import { readFile } from 'node:fs/promises'
import type { HttpContext } from '@adonisjs/core/http'
import { mintInternalJwt, type InternalJwtClaims } from '#services/internal_jwt_service'
import { fetchWithTimeout } from '#services/fetch_with_timeout'

export interface ProxyOptions {
  targetUrl: string
  method?: string
  jwt?: InternalJwtClaims
  forwardQueryString?: boolean
  binary?: boolean
  /**
   * Pour les appelants externes qui portent leur propre schéma d'auth
   * (ex. AREGIE, clé Bearer statique vérifiée par le service cible) — on
   * relaie l'en-tête Authorization tel quel plutôt que de le remplacer par
   * un JWT interne. Jamais combiné avec `jwt` : le service cible n'attend
   * qu'un seul type de jeton par route.
   */
  forwardAuthorization?: boolean
}

export async function proxyRequest(ctx: HttpContext, options: ProxyOptions): Promise<void> {
  const method = options.method ?? ctx.request.method()

  let url = options.targetUrl
  if (options.forwardQueryString) {
    const qs = new URLSearchParams(ctx.request.qs() as Record<string, string>).toString()
    if (qs) url += (url.includes('?') ? '&' : '?') + qs
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.jwt) {
    headers.Authorization = `Bearer ${await mintInternalJwt(options.jwt)}`
  } else if (options.forwardAuthorization) {
    const incoming = ctx.request.header('authorization')
    if (incoming) headers.Authorization = incoming
  }

  const hasBody = !['GET', 'HEAD'].includes(method.toUpperCase())

  const response = await fetchWithTimeout(url, {
    method,
    headers,
    body: hasBody ? JSON.stringify(ctx.request.body()) : undefined,
    redirect: 'manual',
  })

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location')
    if (location) {
      ctx.response.header('location', location)
      ctx.response.status(response.status)
      ctx.response.send('')
      return
    }
  }

  if (options.binary) {
    const contentType = response.headers.get('content-type')
    const contentDisposition = response.headers.get('content-disposition')
    if (contentType) ctx.response.header('content-type', contentType)
    if (contentDisposition) ctx.response.header('content-disposition', contentDisposition)
    const buffer = Buffer.from(await response.arrayBuffer())
    ctx.response.status(response.status).send(buffer)
    return
  }

  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  ctx.response.status(response.status).send(body)
}

export interface ProxyUploadOptions {
  targetUrl: string
  jwt: InternalJwtClaims
  fileFieldName?: string
}

/**
 * proxyRequest ne sait relayer que du JSON (Content-Type fixé en dur) :
 * pour un upload multipart, on doit relire le fichier reçu par le
 * gateway et reconstruire un FormData vers le service cible — un
 * chemin dédié plutôt qu'une branche conditionnelle dans proxyRequest,
 * pour ne pas complexifier le cas JSON qui reste l'immense majorité des
 * routes.
 */
export async function proxyUpload(ctx: HttpContext, options: ProxyUploadOptions): Promise<void> {
  const fieldName = options.fileFieldName ?? 'logo'

  const file = ctx.request.file(fieldName, {
    size: '1.5mb',
    extnames: ['png', 'jpg', 'jpeg', 'svg'],
  })
  if (!file) {
    ctx.response.status(400).send({ error: `${fieldName}_required` })
    return
  }
  if (!file.isValid) {
    ctx.response.status(400).send({ error: `invalid_${fieldName}`, detail: file.errors })
    return
  }

  const buffer = await readFile(file.tmpPath!)
  const formData = new FormData()
  formData.append(
    fieldName,
    new Blob([buffer], { type: `${file.type}/${file.subtype}` }),
    file.clientName
  )

  // Pas de Content-Type manuel : FormData génère lui-même le boundary
  // multipart, le fixer à la main casserait l'encodage.
  const response = await fetchWithTimeout(options.targetUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await mintInternalJwt(options.jwt)}` },
    body: formData,
    redirect: 'manual',
  })

  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  ctx.response.status(response.status).send(body)
}
