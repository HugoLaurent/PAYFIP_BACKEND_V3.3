import { logoBase64 } from '#services/aregie_logo'
import { escapeHtml, euros } from '#services/mail_html_utils'

export interface TicketConfirmationEmailData {
  email: string
  confirmation: string
  visitDate: string
  billetsSummary: string
  totalAmountCents: number
}

export function renderTicketConfirmationEmail(data: TicketConfirmationEmailData): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Réservation confirmée</title>
</head>
<body style="margin:0; padding:0; font-family:'Segoe UI', Roboto, sans-serif; color:#111827;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb; padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.05);">

          <!-- Header -->
          <tr>
            <td style="padding:24px 32px; text-align:center; background-color:#1d4ed8;">
              <h1 style="margin:0; font-size:24px; color:#ffffff;">Réservation confirmée !</h1>
              <p style="margin:8px 0 0; font-size:15px; color:#fdfdfd;">Vos billets ont bien été réservés.</p>
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
              <p style="margin-bottom:16px;">Merci pour votre réservation. Voici vos informations :</p>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:8px; font-weight:bold;">Email</td>
                  <td style="padding-bottom:8px; text-align:right;">${escapeHtml(data.email)}</td>
                </tr>
                <tr>
                  <td style="padding-bottom:8px; font-weight:bold;">N° de commande</td>
                  <td style="padding-bottom:8px; text-align:right; font-family:'Courier New', monospace; font-weight:bold; letter-spacing:0.5px;">${escapeHtml(data.confirmation)}</td>
                </tr>
                <tr>
                  <td style="padding-bottom:8px; font-weight:bold;">Date de visite</td>
                  <td style="padding-bottom:8px; text-align:right;">${escapeHtml(data.visitDate)}</td>
                </tr>
                <tr>
                  <td style="padding-bottom:8px; font-weight:bold;">Billets</td>
                  <td style="padding-bottom:8px; text-align:right;">${escapeHtml(data.billetsSummary)}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold;">Montant total</td>
                  <td style="text-align:right;">${euros(data.totalAmountCents)} €</td>
                </tr>
              </table>

              <p style="margin-top:24px; text-align:center; color:#6b7280; font-size:13px;">
                En cas de question, communiquez ce numéro de commande à un agent.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px; background-color:#f1f5f9; text-align:center; color:#6b7280; font-size:12px;">
              Un service de billetterie sécurisé proposé par <strong>AREGIE</strong>
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
