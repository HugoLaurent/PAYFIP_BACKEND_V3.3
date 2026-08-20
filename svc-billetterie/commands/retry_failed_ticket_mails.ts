import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class RetryFailedTicketMails extends BaseCommand {
  static commandName = 'ticket-mails:retry'
  static description =
    "Rejoue les emails de confirmation de billets dont svc-mail était injoignable au premier essai"

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const { retryFailedTicketMails } = await import('#services/ticket_mail_retry_service')
    const count = await retryFailedTicketMails()
    this.logger.info(`${count} email(s) de confirmation en échec retenté(s)`)
  }

  async completed() {
    const db = await this.app.container.make('lucid.db')
    await db.manager.closeAll(true)
  }
}
