import { escapeHtml, euros } from '#services/mail_html_utils'

export interface InscriptionEventCancelledEmailData {
  email: string
  eventTitle: string
  // Déjà formatée en chaîne d'affichage par l'appelant, même convention que
  // les autres dates transmises aux templates svc-mail.
  eventDate?: string
  // true seulement si un paiement PayFiP avait déjà été encaissé
  // (registration.status === 'confirmed' au moment de l'annulation) —
  // affiche alors le montant et invite à contacter l'organisme, aucun
  // remboursement n'étant déclenché automatiquement par cet envoi.
  wasPaid: boolean
  amountCents: number
  serviceName?: string
  orgName?: string
  logoUrl?: string
}

// Même palette bleu AREGIE que tous les autres templates — plus de rouge
// nulle part, y compris sur le bandeau "déjà réglé" (uniformité demandée
// entre tous les emails).
const AREGIE_BLUE = '#0080c0'
const BLUE_TINT = '#e6f3fa'
const MARINE = '#223499'

export function renderInscriptionEventCancelledEmail(data: InscriptionEventCancelledEmailData): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Évènement annulé</title>
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
          <tr><td style="padding:14px 32px 0; text-align:center; font-size:24px; font-weight:800; line-height:30px; color:#121b29;">Cet évènement est annulé</td></tr>
          <tr><td style="padding:10px 32px 0; text-align:center; font-size:15px; line-height:23px; color:#4f5661;">L'organisme a annulé l'évènement auquel vous étiez inscrit(e). Votre inscription est annulée, aucune action n'est requise de votre part.</td></tr>

          <tr><td style="padding:22px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f2f5fb; border-radius:12px;">
              <tr><td style="padding:16px 20px;">
                <div style="font-size:11px; font-weight:600; letter-spacing:1.4px; color:#7b8189;">ÉVÈNEMENT ANNULÉ</div>
                <div style="padding-top:6px; font-size:20px; font-weight:800; color:#121b29;">${escapeHtml(data.eventTitle)}</div>
                ${
                  data.eventDate
                    ? `<div style="padding-top:4px; font-size:14px; font-weight:600; color:#4f5661;">${escapeHtml(data.eventDate)}</div>`
                    : ''
                }
              </td></tr>
            </table>
          </td></tr>

          ${
            data.wasPaid
              ? `<tr><td style="padding:20px 32px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BLUE_TINT}; border-radius:12px;">
              <tr><td style="padding:16px 20px;">
                <div style="font-size:11px; font-weight:600; letter-spacing:1.4px; color:${AREGIE_BLUE};">MONTANT DÉJÀ RÉGLÉ</div>
                <div style="padding-top:6px; font-size:20px; font-weight:800; color:${AREGIE_BLUE};">${euros(data.amountCents)} €</div>
                <div style="padding-top:8px; font-size:14px; line-height:21px; color:#4f5661;">Ce montant n'a pas été remboursé automatiquement. Merci de contacter directement ${
                  data.orgName ? `<strong>${escapeHtml(data.orgName)}</strong>` : "l'organisme"
                } pour convenir d'un remboursement.</div>
              </td></tr>
            </table>
          </td></tr>`
              : `<tr><td align="center" style="padding:20px 32px 28px; font-size:13px; line-height:20px; color:#7b8189;">Aucune somme ne vous sera prélevée pour cette inscription.</td></tr>`
          }

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
