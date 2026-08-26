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
    // Défense en profondeur : la vraie coupure du HTTP en clair doit se
    // faire à la couche qui termine le TLS (le reverse proxy, en amont de
    // ce conteneur) — un en-tête ici ne protège que les clients qui
    // reçoivent déjà une réponse HTTPS, pas ceux qui restent bloqués sur
    // du HTTP simple faute de redirection en amont.
    ctx.response.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    return next()
  }
}
