import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class RetryFailedRegistrationMails extends BaseCommand {
  static commandName = 'registration-mails:retry'
  static description =
    "Rejoue les emails d'inscription (confirmation, demande de paiement, rejet, offre de liste d'attente) dont svc-mail était injoignable au premier essai"

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const { retryFailedRegistrationMails } = await import(
      '#services/registration_mail_retry_service'
    )
    const count = await retryFailedRegistrationMails()
    this.logger.info(`${count} email(s) d'inscription en échec retenté(s)`)
  }

  async completed() {
    const db = await this.app.container.make('lucid.db')
    await db.manager.closeAll(true)
  }
}
