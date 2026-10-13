import { escapeHtml } from '#services/mail_html_utils'

export interface InscriptionDocumentsReceivedEmailData {
  eventTitle: string
  participantName: string
  participantEmail: string
  registrationReference: string
  // Libellés des pièces demandées par l'évènement, déjà prêts à afficher.
  documents: string[]
  // true = renvoi après un refus (le citoyen a redéposé depuis sa page de suivi).
  resend: boolean
  serviceName?: string
  orgName?: string
  logoUrl?: string
}

// Même palette bleu AREGIE que tous les autres templates.
const AREGIE_BLUE = '#0080c0'
const BLUE_TINT = '#e6f3fa'
const MARINE = '#223499'

// Email destiné à l'AGENT (adresse de réception de l'évènement) : les pièces
// du citoyen sont en pièces jointes. Rien n'est conservé par PayFiP — cet
// email est la seule copie, d'où la référence d'inscription en évidence.
export function renderInscriptionDocumentsReceivedEmail(
  data: InscriptionDocumentsReceivedEmailData
): string {
  const documentItems = data.documents
    .map((label) => `<li style="padding:2px 0;">${escapeHtml(label)}</li>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pièces justificatives reçues</title>
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
          <tr><td style="padding:14px 32px 0; text-align:center; font-size:24px; font-weight:800; line-height:30px; color:#121b29;">${data.resend ? 'Pièces renvoyées à vérifier' : 'Pièces justificatives à vérifier'}</td></tr>
          <tr><td style="padding:10px 32px 0; text-align:center; font-size:15px; line-height:23px; color:#4f5661;"><strong>${escapeHtml(data.participantName)}</strong> a transmis ses pièces pour <strong>${escapeHtml(data.eventTitle)}</strong>. Elles sont en pièces jointes de cet email.</td></tr>

          <tr><td style="padding:22px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BLUE_TINT}; border-radius:12px;">
              <tr><td style="padding:16px 20px;">
                <div style="font-size:11px; font-weight:600; letter-spacing:1.4px; color:${AREGIE_BLUE};">RÉFÉRENCE D'INSCRIPTION</div>
                <div style="padding-top:6px; font-size:20px; font-weight:800; color:${AREGIE_BLUE};">${escapeHtml(data.registrationReference)}</div>
                <div style="padding-top:12px; font-size:11px; font-weight:600; letter-spacing:1.4px; color:${AREGIE_BLUE};">CONTACT DU CITOYEN</div>
                <div style="padding-top:6px; font-size:15px; font-weight:700; color:#121b29;">${escapeHtml(data.participantEmail)}</div>
              </td></tr>
            </table>
          </td></tr>

          <tr><td style="padding:20px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f2f5fb; border-radius:12px;">
              <tr><td style="padding:16px 20px;">
                <div style="font-size:11px; font-weight:600; letter-spacing:1.4px; color:#7b8189;">PIÈCES DEMANDÉES POUR CET ÉVÈNEMENT</div>
                <ul style="margin:8px 0 0; padding-left:20px; font-size:15px; line-height:22px; color:#121b29;">${documentItems}</ul>
              </td></tr>
            </table>
          </td></tr>

          <tr><td align="center" style="padding:20px 32px 28px; font-size:13px; line-height:20px; color:#7b8189;">Contrôlez les pièces jointes puis validez ou refusez l'inscription depuis votre espace organisme. PayFiP ne conserve aucune pièce : cet email est la seule copie transmise.</td></tr>

          <tr><td align="right" style="padding:24px 32px; background-color:#f2f5fb; border-top:1px solid #dee1e7; font-size:12px; line-height:19px; color:#7b8189;">${
            data.orgName || data.serviceName
              ? `Cet email est envoyé automatiquement par <strong style="color:${MARINE};">${escapeHtml(data.orgName ?? data.serviceName!)}</strong>. Ne répondez pas à ce message, écrivez au citoyen à l'adresse indiquée ci-dessus.<br>`
              : "Ne répondez pas à ce message, écrivez au citoyen à l'adresse indiquée ci-dessus.<br>"
          }<a href="#" style="color:${AREGIE_BLUE}; text-decoration:none;">aregie.fr</a> · Mentions légales</td></tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}
