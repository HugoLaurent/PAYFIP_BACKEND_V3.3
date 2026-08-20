import env from '#start/env'
import { mintFacturesJwt } from '#services/internal_jwt_service'
import { fetchWithTimeout } from '#services/fetch_with_timeout'

export interface SendMailParams {
  template: string
  to: string
  data: Record<string, unknown>
}

export async function sendMail(params: SendMailParams): Promise<{ sent: boolean }> {
  const token = await mintFacturesJwt({ orgId: '0', scope: 'factures', aud: 'svc-mail' })

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
