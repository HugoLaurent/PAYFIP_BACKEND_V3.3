import { SignJWT, importJWK } from 'jose'
import env from '#start/env'
import { fetchWithTimeout } from '#services/fetch_with_timeout'

function decodeJwk(base64: string) {
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'))
}

const privateKeyPromise = importJWK(decodeJwk(env.get('INSCRIPTION_JWT_PRIVATE_KEY')), 'EdDSA')

export interface MailAttachment {
  filename: string
  contentBase64: string
  contentType: string
}

export interface SendMailParams {
  template: string
  to: string
  // Choisit la clé API AREGIE Mail du service plutôt que la clé par
  // défaut — absent pour les emails sans service (OTP).
  serviceId?: string
  data: Record<string, unknown>
  attachments?: MailAttachment[]
  // Copies (CC) — uniquement pour un envoi `ephemeral`.
  cc?: string[]
  // Envoi éphémère : svc-mail ne stocke pas les pièces jointes et ne rejoue
  // pas un échec (voir svc-mail, emails_controller.ts). Utilisé pour relayer
  // les pièces justificatives des citoyens.
  ephemeral?: boolean
}

export async function sendMail(params: SendMailParams): Promise<{ sent: boolean }> {
  const privateKey = await privateKeyPromise
  const token = await new SignJWT({ orgId: '0', scope: 'inscription' })
    .setProtectedHeader({ alg: 'EdDSA', kid: 'svc-inscription' })
    .setIssuedAt()
    .setExpirationTime('2m')
    .setAudience('svc-mail')
    .sign(privateKey)

  const request = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  }
  // Pièces jointes jusqu'à ~13 Mo en base64, relayées jusqu'à AREGIE Mail :
  // le délai par défaut (15 s) est trop court pour un envoi éphémère.
  const response = params.ephemeral
    ? await fetch(`${env.get('SVC_MAIL_BASE_URL')}/emails`, { ...request, signal: AbortSignal.timeout(90_000) })
    : await fetchWithTimeout(`${env.get('SVC_MAIL_BASE_URL')}/emails`, request)

  if (!response.ok) {
    throw new Error(`svc-mail a répondu ${response.status}`)
  }

  const { data } = (await response.json()) as { data: { sent: boolean } }
  return data
}
