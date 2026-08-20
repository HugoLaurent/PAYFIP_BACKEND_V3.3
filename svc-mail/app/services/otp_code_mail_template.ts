import { logoBase64 } from '#services/aregie_logo'

export interface OtpCodeEmailData {
  code: string
  ttlMinutes: number
}

export function renderOtpCodeEmail(data: OtpCodeEmailData): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Vérification Email</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: 'Segoe UI', Roboto, sans-serif; color: #111827;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">

          <!-- Logo -->
          <tr>
            <td style="text-align: center; padding: 24px;">
              <img src="data:image/png;base64,${logoBase64}" alt="AREGIE" style="max-width: 160px; height: auto;"/>
            </td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 24px 32px; text-align: center; background-color: #1d4ed8;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px;">Validation de votre email</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin-bottom: 16px;">Bonjour,</p>
              <p style="margin-bottom: 16px;">
                Merci pour votre demande. Voici votre code de vérification :
              </p>
              <div style="font-size: 24px; font-weight: bold; letter-spacing: 4px; margin: 24px 0; text-align: center; color: #1d4ed8;">
                <code>${data.code}</code>
              </div>
              <p style="margin-bottom: 0;">
                Ce code est valable pendant ${data.ttlMinutes} minutes. Si vous n'avez pas initié cette demande, ignorez simplement ce message.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 32px; background-color: #f1f5f9; text-align: center; color: #6b7280; font-size: 12px;">
              Un service de paiement sécurisé proposé et propulsé par <strong>AREGIE</strong>
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
