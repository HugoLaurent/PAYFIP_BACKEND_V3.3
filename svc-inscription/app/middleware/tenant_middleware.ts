import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Point d'accroche pour la résolution de tenant avant le contrôleur —
 * volontairement inerte : `serviceIds` (JWT agent) est un tableau, jamais
 * un serviceId unique, donc même ici une résolution générique pré-
 * contrôleur ne suffirait pas pour les routes à ressource unique
 * (registrations/:id, events/:id...). Le choix retenu route plutôt
 * chaque contrôleur explicitement — `serviceId` demandé en paramètre là
 * où l'appelant (agent ou citoyen ayant déjà vu la liste/le lien du
 * service) le connaît déjà, fan-out borné par organisme uniquement là où
 * il ne peut structurellement pas être fourni (accessToken). Voir les
 * contrôleurs events_controller.ts/registrations_controller.ts.
 */
export default class TenantMiddleware {
  async handle(_ctx: HttpContext, next: NextFn) {
    return next()
  }
}
