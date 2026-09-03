import { escapeHtml } from '#services/mail_html_utils'

export interface InscriptionAgentReviewNeededEmailData {
  email: string
  eventTitle: string
  registrantName: string
  serviceName?: string
  orgName?: string
  logoUrl?: string
}

// Adressé à un agent/admin, pas à un citoyen — même palette bleu AREGIE que
// les autres emails d'inscription (le corail reste réservé aux emails qui
// demandent une action au citoyen), mais sans bouton d'action : l'agent
// n'a qu'à se connecter à son espace habituel, pas de lien profond dédié.
const AREGIE_BLUE = '#0080c0'
const BLUE_TINT = '#e6f3fa'
const MARINE = '#223499'

export function renderInscriptionAgentReviewNeededEmail(data: InscriptionAgentReviewNeededEmailData): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nouvelle inscription à vérifier</title>
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

          <tr><td style="padding:${data.logoUrl ? '10' : '24'}px 32px 0; text-align:center; font-size:11px; font-weight:600; letter-spacing:1.4px; color:#7b8189;">${escapeHtml((data.serviceName ?? 'INSCRIPTION').toUpperCase())}</td></tr>
          <tr><td style="padding:14px 32px 0; text-align:center; font-size:24px; font-weight:800; line-height:30px; color:#121b29;">Une inscription attend votre vérification</td></tr>
          <tr><td style="padding:10px 32px 0; text-align:center; font-size:15px; line-height:23px; color:#4f5661;">Un justificatif a été déposé et nécessite votre validation avant confirmation.</td></tr>

          <tr><td style="padding:22px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BLUE_TINT}; border-radius:12px;">
              <tr><td style="padding:16px 20px;">
                <div style="font-size:11px; font-weight:600; letter-spacing:1.4px; color:${AREGIE_BLUE};">ÉVÈNEMENT</div>
                <div style="padding-top:6px; font-size:20px; font-weight:800; color:${AREGIE_BLUE};">${escapeHtml(data.eventTitle)}</div>
                <div style="padding-top:8px; font-size:11px; font-weight:600; letter-spacing:1.4px; color:${AREGIE_BLUE};">INSCRIT</div>
                <div style="padding-top:4px; font-size:15px; font-weight:700; color:#121b29;">${escapeHtml(data.registrantName)}</div>
              </td></tr>
            </table>
          </td></tr>

          <tr><td align="center" style="padding:24px 32px 28px; font-size:13px; line-height:20px; color:#7b8189;">Connectez-vous à votre espace organisme pour consulter le justificatif et le valider ou le rejeter.</td></tr>

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
