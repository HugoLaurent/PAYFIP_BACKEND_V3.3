import { logoBase64 } from '#services/aregie_logo'

export interface OtpCodeEmailData {
  code: string
  ttlMinutes: number
}

// Même règle que les autres templates : accent bleu AREGIE, corail
// réservé au bouton d'action du parcours d'achat web.
const AREGIE_BLUE = '#0080c0'
const BLUE_TINT = '#bfe3f4'

export function renderOtpCodeEmail(data: OtpCodeEmailData): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Vérification Email</title>
</head>
<body style="margin:0; padding:0; background-color:#f2f5fb; font-family:'Segoe UI', Roboto, sans-serif; color:#121b29;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f2f5fb; padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(18,27,41,.08);">

          <tr><td height="6" style="height:6px; background-color:${AREGIE_BLUE}; line-height:6px; font-size:0;">&nbsp;</td></tr>

          <tr>
            <td align="center" style="padding:24px 32px 0;">
              <img src="data:image/png;base64,${logoBase64}" alt="AREGIE" style="max-width:140px; height:auto;" />
            </td>
          </tr>

          <tr><td style="padding:6px 32px 0; text-align:center; font-size:11px; font-weight:600; letter-spacing:1.4px; color:#7b8189;">AREGIE · VÉRIFICATION</td></tr>
          <tr><td style="padding:14px 32px 0; text-align:center; font-size:22px; font-weight:800; line-height:28px; color:#121b29;">Votre code de vérification</td></tr>
          <tr><td style="padding:8px 44px 0; text-align:center; font-size:15px; line-height:23px; color:#4f5661;">Saisissez ce code pour continuer votre paiement.</td></tr>

          <tr><td align="center" style="padding:26px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#121b29; border-radius:14px;">
              <tr><td align="center" style="padding:26px 20px 22px;">
                <div style="font-family:Consolas,'Courier New',monospace; font-size:40px; font-weight:700; letter-spacing:12px; line-height:48px; color:#ffffff; padding-left:12px;">${data.code}</div>
                <div style="padding-top:10px; font-size:13px; font-weight:600; color:${BLUE_TINT};">Valable ${data.ttlMinutes} minutes</div>
              </td></tr>
            </table>
          </td></tr>

          <tr><td align="center" style="padding:18px 44px 0; font-size:14px; line-height:22px; color:#4f5661;">Nos codes ne contiennent que des chiffres — jamais de lettres, donc aucune confusion possible entre O et 0 ou entre I et 1.</td></tr>

          <tr><td style="padding:24px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f2f5fb; border-radius:12px;">
              <tr><td style="padding:16px 20px; font-size:13px; line-height:20px; color:#4f5661;">Vous n'avez rien demandé ? Ignorez cet email : sans ce code, aucun paiement ne peut aboutir. Ne le transmettez à personne, même à un agent.</td></tr>
            </table>
          </td></tr>

          <tr><td align="right" style="padding:20px 32px; margin-top:24px; background-color:#f2f5fb; font-size:12px; line-height:19px; color:#7b8189;">Ne répondez pas à ce message.<br><a href="#" style="color:${AREGIE_BLUE}; text-decoration:none;">aregie.fr</a> · Mentions légales</td></tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}
