import { DateTime } from 'luxon'
import Invoice from '#models/invoice'
import FailedInvoiceMail from '#models/failed_invoice_mail'
import { sendInvoiceConfirmationEmail } from '#services/invoice_confirmation_mail_service'

export async function retryFailedInvoiceMails(): Promise<number> {
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
}
