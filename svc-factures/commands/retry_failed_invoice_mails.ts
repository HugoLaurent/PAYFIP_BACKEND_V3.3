import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class RetryFailedInvoiceMails extends BaseCommand {
  static commandName = 'invoice-mails:retry'
  static description =
    "Rejoue les emails de confirmation de facture dont svc-mail était injoignable au premier essai"

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const { retryFailedInvoiceMails } = await import('#services/invoice_mail_retry_service')
    const count = await retryFailedInvoiceMails()
    this.logger.info(`${count} email(s) de confirmation en échec retenté(s)`)
  }

  async completed() {
    const db = await this.app.container.make('lucid.db')
    await db.manager.closeAll(true)
  }
}
