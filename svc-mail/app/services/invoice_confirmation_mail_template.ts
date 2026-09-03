import { escapeHtml, euros } from '#services/mail_html_utils'

export interface InvoiceConfirmationEmailData {
  confirmation: string
  objectLabel: string
  amountCents: number
  clientNumber?: string | null
  // Identité du service émetteur (logo + nom), pas AREGIE — voir
  // ticket_confirmation_mail_template.ts. Absents si le paiement n'est
  // rattaché à aucun service, ou si svc-auth était injoignable à l'envoi.
  serviceName?: string
  orgName?: string
  logoUrl?: string
}

// Même règle que le billet : accent bleu AREGIE, corail réservé au bouton
// du parcours d'achat web.
const AREGIE_BLUE = '#0080c0'
const BLUE_TINT = '#e6f3fa'
const MARINE = '#223499'

export function renderInvoiceConfirmationEmail(data: InvoiceConfirmationEmailData): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Paiement confirmé</title>
</head>
<body style="margin:0; padding:0; background-color:#f2f5fb; font-family:'Segoe UI', Roboto, sans-serif; color:#121b29;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f2f5fb; padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(18,27,41,.08);">

          <tr><td height="6" style="height:6px; background-color:${AREGIE_BLUE}; line-height:6px; font-size:0;">&nbsp;</td></tr>

          ${
            data.logoUrl
              ? `<tr>
            <td align="center" style="padding:24px 32px 0;">
              <img src="${escapeHtml(data.logoUrl)}" alt="${escapeHtml(data.serviceName ?? '')}" width="56" height="56" style="width:56px; height:56px; border-radius:16px; object-fit:contain; background-color:#f2f5fb;" />
            </td>
          </tr>`
              : ''
          }

          <tr><td style="padding:${data.logoUrl ? '10' : '24'}px 32px 0; text-align:center; font-size:11px; font-weight:600; letter-spacing:1.4px; color:#7b8189;">${escapeHtml((data.serviceName ?? 'FACTURES').toUpperCase())}</td></tr>
          <tr><td style="padding:14px 32px 0; text-align:center; font-size:24px; font-weight:800; line-height:30px; color:#121b29;">Votre paiement est confirmé</td></tr>
          <tr><td style="padding:10px 32px 0; text-align:center; font-size:15px; line-height:23px; color:#4f5661;">Merci, votre règlement a bien été enregistré. Ce message vaut justificatif de paiement.</td></tr>

          <tr><td style="padding:22px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BLUE_TINT}; border-radius:12px;">
              <tr><td style="padding:16px 20px;">
                <div style="font-size:11px; font-weight:600; letter-spacing:1.4px; color:${AREGIE_BLUE};">MONTANT RÉGLÉ</div>
                <div style="padding-top:6px; font-size:28px; font-weight:800; color:${AREGIE_BLUE};">${euros(data.amountCents)} €</div>
              </td></tr>
            </table>
          </td></tr>

          <tr><td style="padding:24px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="42%" style="padding:12px 0; border-bottom:1px solid #dee1e7; font-size:13px; color:#7b8189;">Objet</td>
                <td align="right" style="padding:12px 0; border-bottom:1px solid #dee1e7; font-size:15px; font-weight:600; color:#121b29;">${escapeHtml(data.objectLabel)}</td>
              </tr>
              <tr>
                <td style="padding:12px 0; ${data.clientNumber ? 'border-bottom:1px solid #dee1e7; ' : ''}font-size:13px; color:#7b8189;">Confirmation</td>
                <td align="right" style="padding:12px 0; ${data.clientNumber ? 'border-bottom:1px solid #dee1e7; ' : ''}font-family:Consolas,'Courier New',monospace; font-size:15px; font-weight:700; color:#121b29;">${escapeHtml(data.confirmation)}</td>
              </tr>
              ${
                data.clientNumber
                  ? `<tr>
                <td style="padding:12px 0; font-size:13px; color:#7b8189;">N° client</td>
                <td align="right" style="padding:12px 0; font-family:Consolas,'Courier New',monospace; font-size:15px; font-weight:700; color:#121b29;">${escapeHtml(data.clientNumber)}</td>
              </tr>`
                  : ''
              }
            </table>
          </td></tr>

          <tr><td align="center" style="padding:24px 32px 28px; font-size:13px; line-height:20px; color:#7b8189;">Votre paiement est enregistré. Il sera transmis à l'organisme. Conservez ce numéro de confirmation pour toute question.</td></tr>

          <tr><td align="right" style="padding:24px 32px; background-color:#f2f5fb; border-top:1px solid #dee1e7; font-size:12px; line-height:19px; color:#7b8189;">${
            data.orgName || data.serviceName
              ? `Cet email vous est envoyé par <strong style="color:${MARINE};">${escapeHtml(data.orgName ?? data.serviceName!)}</strong>. Ne répondez pas à ce message.<br>`
              : 'Ne répondez pas à ce message.<br>'
          }<a href="#" style="color:${AREGIE_BLUE}; text-decoration:none;">aregie.fr</a> · Mentions légales</td></tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}
