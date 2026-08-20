export interface SaisiePaiementParams {
  numcli: string
  exer: number
  reference: string
  objectLabel: string
  amountCents: number
  payerEmail: string
  urlNotif: string
  urlRedirect: string
  saisie: 'T' | 'X' | 'W'
}

export interface SaisiePaiementResult {
  idOp: string
}

export type PayfipResolutionStatus = 'paid' | 'failed' | 'unknown'

export interface RecupererDetailResult {
  status: PayfipResolutionStatus
  resultCode: string
  numAuto?: string | null
  raw: Record<string, unknown>
}

export interface PayfipClient {
  saisiePaiement(params: SaisiePaiementParams): Promise<SaisiePaiementResult>
  recupererDetailPaiementSecurise(idOp: string): Promise<RecupererDetailResult>
}
