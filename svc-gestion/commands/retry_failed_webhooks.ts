import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class RetryFailedWebhooks extends BaseCommand {
  static commandName = 'webhooks:retry'
  static description =
    'Rejoue les livraisons de webhook en échec dont le délai de nouvelle tentative est passé'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const { retryFailedDeliveries } = await import('#services/webhook_dispatcher_service')
    const count = await retryFailedDeliveries()
    this.logger.info(`${count} livraison(s) en échec retentée(s)`)
  }

  async completed() {
    const db = await this.app.container.make('lucid.db')
    await db.manager.closeAll(true)
  }
}
