import type {
  PayfipResolutionStatus,
  RecupererDetailResult,
  SaisiePaiementResult,
} from '#services/payfip/types'
import { PayfipUnexpectedResponseError } from '#services/payfip/soap/errors'

const RESULTRANS_TO_STATUS: Record<string, PayfipResolutionStatus> = {
  P: 'paid',
  V: 'paid',
  A: 'failed',
  R: 'failed',
  Z: 'failed',
}

export function mapCreerPaiementSuccess(fields: Record<string, string | null>): SaisiePaiementResult {
  const idOp = fields.idop ?? fields.return
  if (!idOp) {
    throw new PayfipUnexpectedResponseError('creerPaiementSecuriseResponse sans idop')
  }
  return { idOp }
}

export function mapRecupererDetailSuccess(
  fields: Record<string, string | null>
): RecupererDetailResult {
  const resultrans = fields.resultrans ?? ''
  return {
    status: RESULTRANS_TO_STATUS[resultrans] ?? 'unknown',
    resultCode: resultrans,
    numAuto: fields.numauto ?? null,
    raw: fields,
  }
}
