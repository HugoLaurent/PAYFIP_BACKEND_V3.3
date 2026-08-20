import { logoBase64 } from '#services/aregie_logo'
import { escapeHtml, euros } from '#services/mail_html_utils'

export interface InvoiceConfirmationEmailData {
  confirmation: string
  objectLabel: string
  amountCents: number
  clientNumber?: string | null
}

export function renderInvoiceConfirmationEmail(data: InvoiceConfirmationEmailData): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Paiement confirmé</title>
</head>
<body style="margin:0; padding:0; font-family:'Segoe UI', Roboto, sans-serif; color:#111827;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb; padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.05);">

          <!-- Header -->
          <tr>
            <td style="padding:24px 32px; text-align:center; background-color:#1d4ed8;">
              <h1 style="margin:0; font-size:24px; color:#ffffff;">Paiement confirmé !</h1>
              <p style="margin:8px 0 0; font-size:15px; color:#fdfdfd;">Votre facture a bien été réglée.</p>
            </td>
          </tr>

          <!-- Logo -->
          <tr>
            <td style="text-align:center; padding:24px;">
              <img src="data:image/png;base64,${logoBase64}" alt="AREGIE" style="max-width: 160px; height: auto;"/>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin-bottom:16px;">Bonjour,</p>
              <p style="margin-bottom:16px;">Merci pour votre règlement. Voici le récapitulatif :</p>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:8px; font-weight:bold;">Confirmation</td>
                  <td style="padding-bottom:8px; text-align:right;">${escapeHtml(data.confirmation)}</td>
                </tr>
                <tr>
                  <td style="padding-bottom:8px; font-weight:bold;">Objet</td>
                  <td style="padding-bottom:8px; text-align:right;">${escapeHtml(data.objectLabel)}</td>
                </tr>
                ${
                  data.clientNumber
                    ? `<tr>
                  <td style="padding-bottom:8px; font-weight:bold;">N° client</td>
                  <td style="padding-bottom:8px; text-align:right;">${escapeHtml(data.clientNumber)}</td>
                </tr>`
                    : ''
                }
                <tr>
                  <td style="font-weight:bold;">Montant réglé</td>
                  <td style="text-align:right;">${euros(data.amountCents)} €</td>
                </tr>
              </table>

              <p style="margin-top:24px; text-align:center;">
                Votre paiement est enregistré. Il sera transmis à l'organisme.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px; background-color:#f1f5f9; text-align:center; color:#6b7280; font-size:12px;">
              Un service de paiement sécurisé proposé par <strong>AREGIE</strong>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}
