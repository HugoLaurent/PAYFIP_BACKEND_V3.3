import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class RetryFailedEmails extends BaseCommand {
  static commandName = 'emails:retry'
  static description =
    "Rejoue les envois d'email en échec dont le délai de nouvelle tentative est passé"

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const { retryFailedDeliveries } = await import('#services/email_dispatcher_service')
    const count = await retryFailedDeliveries()
    this.logger.info(`${count} email(s) en échec retenté(s)`)
  }

  async completed() {
    const db = await this.app.container.make('lucid.db')
    await db.manager.closeAll(true)
  }
}
