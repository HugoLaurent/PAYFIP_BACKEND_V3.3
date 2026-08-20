import env from '#start/env'
import type {
  PayfipClient,
  RecupererDetailResult,
  SaisiePaiementParams,
  SaisiePaiementResult,
} from '#services/payfip/types'
import { fetchWithTimeout } from '#services/fetch_with_timeout'

function baseUrl(): string {
  const url = env.get('FAKE_PAYFIP_BASE_URL')
  if (!url) {
    throw new Error('FAKE_PAYFIP_BASE_URL doit être défini quand PAYFIP_MODE=fake')
  }
  return url
}

export default class FakePayfipClient implements PayfipClient {
  async saisiePaiement(params: SaisiePaiementParams): Promise<SaisiePaiementResult> {
    const response = await fetchWithTimeout(`${baseUrl()}/saisiepaiement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        numcli: params.numcli,
        exer: params.exer,
        amountCents: params.amountCents,
        objectLabel: params.objectLabel,
        reference: params.reference,
        payerEmail: params.payerEmail,
        urlNotif: params.urlNotif,
        urlRedirect: params.urlRedirect,
        saisie: params.saisie,
      }),
    })

    if (!response.ok) {
      throw new Error(`fake-payfip a répondu ${response.status} sur /saisiepaiement`)
    }

    const { idOp } = (await response.json()) as { idOp: string }
    return { idOp }
  }

  async recupererDetailPaiementSecurise(idOp: string): Promise<RecupererDetailResult> {
    const response = await fetchWithTimeout(`${baseUrl()}/infopaiement/${idOp}`)

    if (!response.ok) {
      throw new Error(`fake-payfip a répondu ${response.status} sur /infopaiement`)
    }

    return (await response.json()) as RecupererDetailResult
  }
}
