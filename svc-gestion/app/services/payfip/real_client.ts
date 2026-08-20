import env from '#start/env'
import type {
  PayfipClient,
  RecupererDetailResult,
  SaisiePaiementParams,
  SaisiePaiementResult,
} from '#services/payfip/types'
import { buildCreerPaiementEnvelope, buildRecupererDetailEnvelope } from '#services/payfip/soap/envelope'
import { postSoapEnvelope } from '#services/payfip/soap/http'
import { parseSoapResponse } from '#services/payfip/soap/parser'
import { mapCreerPaiementSuccess, mapRecupererDetailSuccess } from '#services/payfip/soap/mapper'
import {
  PayfipFunctionalError,
  PayfipTechnicalError,
} from '#services/payfip/soap/errors'

function soapUrl(): string {
  const url = env.get('PAYFIP_SOAP_URL')
  if (!url) {
    throw new Error('PAYFIP_SOAP_URL doit être défini quand PAYFIP_MODE=real')
  }
  return url
}

function timeoutMs(): number {
  return env.get('PAYFIP_SOAP_TIMEOUT_MS') ?? 15_000
}

const RECUPERER_DETAIL_FIELDS = [
  'numcli',
  'exer',
  'refdet',
  'objet',
  'montant',
  'mel',
  'saisie',
  'resultrans',
  'numauto',
  'dattrans',
  'heurtrans',
  'idop',
]

export default class RealPayfipClient implements PayfipClient {
  async saisiePaiement(params: SaisiePaiementParams): Promise<SaisiePaiementResult> {
    const xml = await postSoapEnvelope(soapUrl(), buildCreerPaiementEnvelope(params), timeoutMs())
    const decoded = parseSoapResponse(xml, ['idop', 'return'])

    if (decoded.kind === 'technicalError') {
      throw new PayfipTechnicalError(decoded.fields)
    }
    if (decoded.kind === 'functionalError') {
      throw new PayfipFunctionalError(
        decoded.fields.code ?? 'unknown',
        decoded.fields.libelle ?? '',
        decoded.fields
      )
    }
    return mapCreerPaiementSuccess(decoded.fields)
  }

  async recupererDetailPaiementSecurise(idOp: string): Promise<RecupererDetailResult> {
    const xml = await postSoapEnvelope(soapUrl(), buildRecupererDetailEnvelope(idOp), timeoutMs())
    const decoded = parseSoapResponse(xml, RECUPERER_DETAIL_FIELDS)

    if (decoded.kind === 'technicalError') {
      throw new PayfipTechnicalError(decoded.fields)
    }
    if (decoded.kind === 'functionalError') {
      return {
        status: 'unknown',
        resultCode: decoded.fields.code ?? 'unknown',
        numAuto: null,
        raw: decoded.fields,
      }
    }
    return mapRecupererDetailSuccess(decoded.fields)
  }
}
