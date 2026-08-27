import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class ProcessRegistrationExpirations extends BaseCommand {
  static commandName = 'registrations:process-expirations'
  static description =
    "Fait transiter les inscriptions bloquées (paiement non résolu, re-dépôt de justificatif hors délai, offre de liste d'attente expirée) et libère les places correspondantes"

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const { processRegistrationExpirations } = await import(
      '#services/registration_expiry_service'
    )
    const result = await processRegistrationExpirations()
    this.logger.info(
      `${result.expiredAwaitingPayment} paiement(s) expiré(s), ` +
        `${result.cancelledUnresolvedRejections} rejet(s) annulé(s) faute de re-dépôt, ` +
        `${result.expiredWaitlistOffers} offre(s) de liste d'attente expirée(s)`
    )
  }

  async completed() {
    const db = await this.app.container.make('lucid.db')
    await db.manager.closeAll(true)
  }
}
