import { DateTime } from 'luxon'
import Invoice from '#models/invoice'
import FailedInvoiceMail from '#models/failed_invoice_mail'
import { sendInvoiceConfirmationEmail } from '#services/invoice_confirmation_mail_service'
import { refreshTenantRegistry } from '#services/tenant_registry_client'
import { runOnAllTenants } from '#services/tenant_connection_service'

/**
 * Appelé par la commande ace `invoice-mails:retry`, qui ne tourne jamais
 * assez longtemps pour bénéficier du rafraîchissement périodique de
 * l'annuaire (réservé au serveur HTTP — voir start/tenant_registry.ts) :
 * rechargement explicite avant le fan-out.
 */
export async function retryFailedInvoiceMails(): Promise<number> {
  await refreshTenantRegistry()

  const counts = await runOnAllTenants(async () => {
    const due = await FailedInvoiceMail.query().where(
      'nextRetryAt',
      '<=',
      DateTime.now().toJSDate()
    )

    for (const failure of due) {
      const invoice = await Invoice.find(failure.invoiceId)
      if (!invoice) continue

      await sendInvoiceConfirmationEmail(invoice)
    }

    return due.length
  })

  return counts.reduce((total, count) => total + count, 0)
}
