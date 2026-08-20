import { PayfipUnreachableError } from '#services/payfip/soap/errors'

const DEFAULT_TIMEOUT_MS = 15_000

export async function postSoapEnvelope(
  url: string,
  envelope: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<string> {
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' },
      body: envelope,
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    throw new PayfipUnreachableError(`PayFiP injoignable sur ${url} : ${(error as Error).message}`)
  }

  const body = await response.text()

  if (!response.ok && !body.includes('Envelope') && !body.includes('Fault')) {
    throw new PayfipUnreachableError(
      `PayFiP a répondu ${response.status} sans enveloppe SOAP exploitable`
    )
  }

  return body
}
