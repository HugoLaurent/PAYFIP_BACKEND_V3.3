import { escapeHtml } from '#services/mail_html_utils'

export interface InscriptionDocumentsRequestedEmailData {
  email: string
  eventTitle: string
  // Libellés des pièces demandées (Event.documentRequirements[].label),
  // déjà prêts à afficher.
  documents: string[]
  // Adresse de l'organisme à laquelle le citoyen envoie ses pièces.
  contactEmail: string
  // À citer dans l'objet de l'email pour que l'agent retrouve l'inscription.
  registrationReference: string
  statusUrl: string
  serviceName?: string
  orgName?: string
  logoUrl?: string
}

// Même palette bleu AREGIE que tous les autres templates.
const AREGIE_BLUE = '#0080c0'
const BLUE_TINT = '#e6f3fa'
const MARINE = '#223499'

export function renderInscriptionDocumentsRequestedEmail(
  data: InscriptionDocumentsRequestedEmailData
): string {
  const documentItems = data.documents
    .map((label) => `<li style="padding:2px 0;">${escapeHtml(label)}</li>`)
    .join('')
  const subject = `Pièces ${data.registrationReference}`

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pièces à envoyer</title>
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
          <tr><td style="padding:14px 32px 0; text-align:center; font-size:24px; font-weight:800; line-height:30px; color:#121b29;">Envoyez vos pièces par email</td></tr>
          <tr><td style="padding:10px 32px 0; text-align:center; font-size:15px; line-height:23px; color:#4f5661;">Votre demande d'inscription à <strong>${escapeHtml(data.eventTitle)}</strong> est enregistrée. Pour qu'elle soit étudiée, envoyez les pièces ci-dessous par email à l'organisme.</td></tr>

          <tr><td style="padding:22px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f2f5fb; border-radius:12px;">
              <tr><td style="padding:16px 20px;">
                <div style="font-size:11px; font-weight:600; letter-spacing:1.4px; color:#7b8189;">PIÈCES À ENVOYER</div>
                <ul style="margin:8px 0 0; padding-left:20px; font-size:15px; line-height:22px; color:#121b29;">${documentItems}</ul>
              </td></tr>
            </table>
          </td></tr>

          <tr><td style="padding:20px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BLUE_TINT}; border-radius:12px;">
              <tr><td style="padding:16px 20px;">
                <div style="font-size:11px; font-weight:600; letter-spacing:1.4px; color:${AREGIE_BLUE};">ADRESSE D'ENVOI</div>
                <div style="padding-top:6px; font-size:18px; font-weight:800; color:${AREGIE_BLUE};">${escapeHtml(data.contactEmail)}</div>
                <div style="padding-top:12px; font-size:11px; font-weight:600; letter-spacing:1.4px; color:${AREGIE_BLUE};">OBJET DE L'EMAIL</div>
                <div style="padding-top:6px; font-size:18px; font-weight:800; color:${AREGIE_BLUE};">${escapeHtml(subject)}</div>
              </td></tr>
            </table>
          </td></tr>

          <tr><td align="center" style="padding:28px 32px 0;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="border-radius:10px; background-color:${MARINE};">
                  <a href="${escapeHtml(data.statusUrl)}" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:700; color:#ffffff; text-decoration:none;">Suivre mon inscription</a>
                </td>
              </tr>
            </table>
          </td></tr>

          <tr><td align="center" style="padding:20px 32px 28px; font-size:13px; line-height:20px; color:#7b8189;">Indiquez impérativement la référence <strong>${escapeHtml(data.registrationReference)}</strong> dans l'objet de votre email. N'envoyez que les pièces demandées. Votre place ne sera confirmée qu'après vérification de vos pièces par l'organisme.</td></tr>

          <tr><td align="right" style="padding:24px 32px; background-color:#f2f5fb; border-top:1px solid #dee1e7; font-size:12px; line-height:19px; color:#7b8189;">${
            data.orgName || data.serviceName
              ? `Cet email vous est envoyé par <strong style="color:${MARINE};">${escapeHtml(data.orgName ?? data.serviceName!)}</strong>. Ne répondez pas à ce message, écrivez à l'adresse indiquée ci-dessus.<br>`
              : 'Ne répondez pas à ce message, écrivez à l\'adresse indiquée ci-dessus.<br>'
          }<a href="#" style="color:${AREGIE_BLUE}; text-decoration:none;">aregie.fr</a> · Mentions légales</td></tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}
