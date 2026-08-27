import { escapeHtml, euros } from '#services/mail_html_utils'

export interface InscriptionPaymentRequestEmailData {
  email: string
  eventTitle: string
  amountCents: number
  // Lien front qui porte l'accessToken de l'inscription — PAS une URL
  // PayFiP brute (une session PayFiP expire en ~15 min, bien avant que le
  // citoyen ne lise cet email). La session PayFiP n'est créée qu'au clic,
  // côté svc-inscription. On ne valide donc que la forme d'URL, pas un
  // domaine PayFiP particulier.
  payUrl: string
  serviceName?: string
  orgName?: string
  logoUrl?: string
}

// Corail réservé au bouton d'action — cet email attend une action du
// citoyen (payer), voir la sémantique de couleur du parcours inscription.
const AREGIE_BLUE = '#0080c0'
const CORAL = '#b63613'
const CORAL_TINT = '#ffebe4'
const MARINE = '#223499'

export function renderInscriptionPaymentRequestEmail(
  data: InscriptionPaymentRequestEmailData
): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Paiement de votre inscription</title>
</head>
<body style="margin:0; padding:0; font-family:'Segoe UI', Roboto, sans-serif; color:#121b29;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(18,27,41,.08);">

          <tr><td height="6" style="height:6px; background-color:${CORAL}; line-height:6px; font-size:0;">&nbsp;</td></tr>

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
          <tr><td style="padding:14px 32px 0; text-align:center; font-size:24px; font-weight:800; line-height:30px; color:#121b29;">Votre inscription est validée, il reste à régler le paiement</td></tr>
          <tr><td style="padding:10px 32px 0; text-align:center; font-size:15px; line-height:23px; color:#4f5661;">Vos justificatifs pour <strong>${escapeHtml(data.eventTitle)}</strong> ont été acceptés. Il ne reste plus qu'à payer pour confirmer définitivement votre place.</td></tr>

          <tr><td style="padding:22px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CORAL_TINT}; border-radius:12px;">
              <tr><td style="padding:16px 20px;">
                <div style="font-size:11px; font-weight:600; letter-spacing:1.4px; color:${CORAL};">MONTANT À RÉGLER</div>
                <div style="padding-top:6px; font-size:28px; font-weight:800; color:${CORAL};">${euros(data.amountCents)} €</div>
              </td></tr>
            </table>
          </td></tr>

          <tr><td align="center" style="padding:28px 32px 0;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="border-radius:10px; background-color:${CORAL};">
                  <a href="${escapeHtml(data.payUrl)}" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:700; color:#ffffff; text-decoration:none;">Payer maintenant</a>
                </td>
              </tr>
            </table>
          </td></tr>

          <tr><td align="center" style="padding:20px 32px 0; font-size:13px; line-height:20px; color:#7b8189;">Ce lien vous est réservé, ne le partagez pas. Votre place reste réservée jusqu'au paiement, sauf expiration du délai indiqué sur votre espace d'inscription.</td></tr>

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
