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
  data: Record<string, unknown>
  attachments?: MailAttachment[]
}

export async function sendMail(params: SendMailParams): Promise<{ sent: boolean }> {
  const privateKey = await privateKeyPromise
  const token = await new SignJWT({ orgId: '0', scope: 'inscription' })
    .setProtectedHeader({ alg: 'EdDSA' })
    .setIssuedAt()
    .setExpirationTime('2m')
    .setAudience('svc-mail')
    .sign(privateKey)

  const response = await fetchWithTimeout(`${env.get('SVC_MAIL_BASE_URL')}/emails`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(`svc-mail a répondu ${response.status}`)
  }

  const { data } = (await response.json()) as { data: { sent: boolean } }
  return data
}
