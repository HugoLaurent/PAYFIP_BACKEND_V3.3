import { escapeHtml } from '#services/mail_html_utils'

export interface InscriptionRegistrationRejectedEmailData {
  email: string
  eventTitle: string
  // Motif rédigé par l'agent, cité mot pour mot au citoyen — ne jamais
  // paraphraser ni reformuler ici, l'interpolation se contente d'échapper
  // le HTML.
  rejectionReason: string
  // Déjà formatée en chaîne d'affichage par l'appelant, même convention
  // que les autres dates transmises aux templates svc-mail.
  documentDeadlineAt: string
  redepositUrl: string
  serviceName?: string
  orgName?: string
  logoUrl?: string
}

// Même palette bleu AREGIE que tous les autres templates — plus de rouge
// nulle part (uniformité demandée entre tous les emails).
const AREGIE_BLUE = '#0080c0'
const BLUE_TINT = '#e6f3fa'
const MARINE = '#223499'

export function renderInscriptionRegistrationRejectedEmail(
  data: InscriptionRegistrationRejectedEmailData
): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Justificatif à compléter</title>
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
          <tr><td style="padding:14px 32px 0; text-align:center; font-size:24px; font-weight:800; line-height:30px; color:#121b29;">Votre justificatif doit être complété</td></tr>
          <tr><td style="padding:10px 32px 0; text-align:center; font-size:15px; line-height:23px; color:#4f5661;">Votre justificatif pour <strong>${escapeHtml(data.eventTitle)}</strong> n'a pas pu être validé. Votre place reste réservée, à condition de déposer un nouveau document avant la date limite.</td></tr>

          <tr><td style="padding:22px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f2f5fb; border-radius:12px;">
              <tr><td style="padding:16px 20px;">
                <div style="font-size:11px; font-weight:600; letter-spacing:1.4px; color:#7b8189;">MOTIF INDIQUÉ PAR L'ORGANISME</div>
                <div style="padding-top:8px; font-size:15px; line-height:22px; color:#121b29; white-space:pre-wrap;">${escapeHtml(data.rejectionReason)}</div>
              </td></tr>
            </table>
          </td></tr>

          <tr><td style="padding:20px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BLUE_TINT}; border-radius:12px;">
              <tr><td style="padding:16px 20px;">
                <div style="font-size:11px; font-weight:600; letter-spacing:1.4px; color:${AREGIE_BLUE};">DATE LIMITE DE RE-DÉPÔT</div>
                <div style="padding-top:6px; font-size:20px; font-weight:800; color:${AREGIE_BLUE};">${escapeHtml(data.documentDeadlineAt)}</div>
              </td></tr>
            </table>
          </td></tr>

          <tr><td align="center" style="padding:28px 32px 0;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="border-radius:10px; background-color:${MARINE};">
                  <a href="${escapeHtml(data.redepositUrl)}" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:700; color:#ffffff; text-decoration:none;">Déposer un nouveau document</a>
                </td>
              </tr>
            </table>
          </td></tr>

          <tr><td align="center" style="padding:20px 32px 28px; font-size:13px; line-height:20px; color:#7b8189;">Sans nouveau dépôt avant la date limite, votre place sera libérée et proposée à une autre personne.</td></tr>

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
