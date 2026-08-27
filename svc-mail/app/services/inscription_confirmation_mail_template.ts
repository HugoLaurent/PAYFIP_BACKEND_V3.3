import { escapeHtml, euros } from '#services/mail_html_utils'

export interface InscriptionConfirmationEmailData {
  email: string
  eventTitle: string
  // Déjà formatées en chaîne d'affichage par l'appelant (svc-inscription),
  // même convention que visitDate dans ticket_confirmation_mail_template.ts
  // — ni Luxon ni ISO brut ne transitent sur le fil JSON entre services.
  eventDate?: string
  eventLocation?: string
  quantity: number
  amountCents: number
  registrationNumber: string
  // Identité du service émetteur (logo + nom), pas AREGIE — voir
  // ticket_confirmation_mail_template.ts. Absents si svc-auth était
  // injoignable au moment de l'envoi.
  serviceName?: string
  orgName?: string
  logoUrl?: string
}

// Même palette que les autres templates : accent bleu AREGIE, corail
// réservé au bouton d'action (absent ici, cet email ne demande rien au
// citoyen).
const AREGIE_BLUE = '#0080c0'
const BLUE_TINT = '#e6f3fa'
const MARINE = '#223499'

export function renderInscriptionConfirmationEmail(data: InscriptionConfirmationEmailData): string {
  const amountLabel = data.amountCents === 0 ? 'Gratuit' : `${euros(data.amountCents)} €`

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Inscription confirmée</title>
</head>
<body style="margin:0; padding:0; font-family:'Segoe UI', Roboto, sans-serif; color:#121b29;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:32px 0;">
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

          <tr><td style="padding:${data.logoUrl ? '10' : '24'}px 32px 0; text-align:center; font-size:11px; font-weight:600; letter-spacing:1.4px; color:#7b8189;">${escapeHtml((data.serviceName ?? 'INSCRIPTION').toUpperCase())}</td></tr>
          <tr><td style="padding:14px 32px 0; text-align:center; font-size:24px; font-weight:800; line-height:30px; color:#121b29;">Votre inscription est confirmée</td></tr>
          <tr><td style="padding:10px 32px 0; text-align:center; font-size:15px; line-height:23px; color:#4f5661;">Bonjour, votre inscription à l'évènement suivant est enregistrée.</td></tr>

          <tr><td style="padding:22px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BLUE_TINT}; border-radius:12px;">
              <tr><td style="padding:16px 20px;">
                <div style="font-size:11px; font-weight:600; letter-spacing:1.4px; color:${AREGIE_BLUE};">ÉVÈNEMENT</div>
                <div style="padding-top:6px; font-size:20px; font-weight:800; color:${AREGIE_BLUE};">${escapeHtml(data.eventTitle)}</div>
                ${
                  data.eventDate
                    ? `<div style="padding-top:4px; font-size:14px; font-weight:600; color:${AREGIE_BLUE};">${escapeHtml(data.eventDate)}</div>`
                    : ''
                }
                ${
                  data.eventLocation
                    ? `<div style="padding-top:2px; font-size:13px; color:#4f5661;">${escapeHtml(data.eventLocation)}</div>`
                    : ''
                }
              </td></tr>
            </table>
          </td></tr>

          <tr><td style="padding:24px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="50%" style="font-size:11px; font-weight:600; letter-spacing:1.4px; color:#7b8189;">PARTICIPANTS</td>
                <td width="50%" style="font-size:11px; font-weight:600; letter-spacing:1.4px; color:#7b8189;">MONTANT</td>
              </tr>
              <tr>
                <td style="padding-top:5px; font-size:15px; font-weight:700; color:#121b29;">${data.quantity}</td>
                <td style="padding-top:5px; font-size:15px; font-weight:700; color:${MARINE};">${amountLabel}</td>
              </tr>
            </table>
          </td></tr>

          <tr><td style="padding:20px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="50%" style="font-size:11px; font-weight:600; letter-spacing:1.4px; color:#7b8189;">N° D'INSCRIPTION</td>
                <td width="50%" style="font-size:11px; font-weight:600; letter-spacing:1.4px; color:#7b8189;">EMAIL</td>
              </tr>
              <tr>
                <td style="padding-top:5px; font-family:Consolas,'Courier New',monospace; font-size:15px; font-weight:700; color:#121b29;">${escapeHtml(data.registrationNumber)}</td>
                <td style="padding-top:5px; font-size:14px; color:#4f5661;">${escapeHtml(data.email)}</td>
              </tr>
            </table>
          </td></tr>

          <tr><td align="center" style="padding:24px 32px 0; font-size:13px; line-height:20px; color:#7b8189;">Conservez ce numéro d'inscription pour toute question.</td></tr>

          <tr><td align="right" style="padding:20px 32px; background-color:#ffffff; margin-top:24px; font-size:12px; line-height:19px; color:#7b8189; text-align:right;">${
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
