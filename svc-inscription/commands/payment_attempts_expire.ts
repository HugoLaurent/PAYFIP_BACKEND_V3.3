import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class PaymentAttemptsExpire extends BaseCommand {
  static commandName = 'payment-attempts:expire'
  static description =
    "Marque expirée toute tentative de paiement encore en attente au-delà de la validité PayFiP (15 min)"

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const { expireStalePaymentAttempts } = await import('#services/payment_attempt_expiry_service')
    const count = await expireStalePaymentAttempts()
    this.logger.info(`${count} tentative(s) de paiement marquée(s) expirée(s)`)
  }

  async completed() {
    const db = await this.app.container.make('lucid.db')
    await db.manager.closeAll(true)
  }
}
