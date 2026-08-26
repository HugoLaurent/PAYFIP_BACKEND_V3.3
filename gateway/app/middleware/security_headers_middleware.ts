import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

// API JSON pure — pas de contenu HTML servi ici (le front est un projet
// séparé), donc pas besoin d'une CSP applicative. X-Content-Type-Options
// reste utile même pour du JSON : empêche un navigateur de renifler le
// contenu d'une réponse et de la réinterpréter comme un autre type.
export default class SecurityHeadersMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    ctx.response.header('X-Content-Type-Options', 'nosniff')
    ctx.response.header('X-Frame-Options', 'DENY')
    ctx.response.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    return next()
  }
}
