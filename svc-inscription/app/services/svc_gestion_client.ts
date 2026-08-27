import { SignJWT, importJWK } from 'jose'
import env from '#start/env'
import { fetchWithTimeout } from '#services/fetch_with_timeout'

function decodeJwk(base64: string) {
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'))
}

const privateKeyPromise = importJWK(decodeJwk(env.get('INSCRIPTION_JWT_PRIVATE_KEY')), 'EdDSA')

export interface CreatePaymentRequestParams {
  orgId: string
  serviceId: number
  sourceReference: string
  amountCents: number
  objectLabel: string
  payerEmail: string
  frontRedirectUrl: string
}

export class SvcGestionError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown
  ) {
    super(`svc-gestion a répondu ${status}`)
    this.name = 'SvcGestionError'
  }
}

export interface PaymentRequestResult {
  id: number
  status: string
  payfipIdOp: string | null
  paymentUrl: string | null
}

/**
 * Appel interne pair à pair (svc-inscription → svc-gestion), pas via le
 * Gateway. On signe nous-mêmes un JWT interne avec notre propre paire de
 * clés — svc-gestion le revalide comme n'importe quel autre appelant.
 */
export async function createPaymentRequest(
  params: CreatePaymentRequestParams
): Promise<PaymentRequestResult> {
  const privateKey = await privateKeyPromise
  const token = await new SignJWT({ orgId: params.orgId, scope: 'inscription' })
    .setProtectedHeader({ alg: 'EdDSA' })
    .setIssuedAt()
    .setExpirationTime('2m')
    .setAudience('svc-gestion')
    .sign(privateKey)

  const response = await fetchWithTimeout(`${env.get('SVC_GESTION_BASE_URL')}/payment-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      serviceId: params.serviceId,
      sourceReference: params.sourceReference,
      amountCents: params.amountCents,
      objectLabel: params.objectLabel,
      payerEmail: params.payerEmail,
      frontRedirectUrl: params.frontRedirectUrl,
      webhookUrl: `${env.get('SELF_BASE_URL')}/payment-webhooks`,
    }),
  })

  if (!response.ok) {
    // On conserve le statut et le corps : un refus métier de svc-gestion
    // (régie non déclarée, par exemple) doit pouvoir être rendu tel quel à
    // l'appelant, et non transformé en 500 avec une trace d'exécution.
    let body: unknown = null
    try {
      body = await response.json()
    } catch {
      body = null
    }
    throw new SvcGestionError(response.status, body)
  }

  const { data } = (await response.json()) as { data: PaymentRequestResult }
  return data
}

/**
 * Nouvel essai après un paiement refusé/annulé/expiré — crée une NOUVELLE
 * demande de paiement (donc un nouvel idOp) liée à l'ancienne. On ne
 * réutilise jamais un idOp périmé : PayFiP le refuserait de toute façon
 * (durée de vie ~15 min).
 */
export async function retryPaymentRequest(
  originalPaymentRequestId: number,
  params: CreatePaymentRequestParams
): Promise<PaymentRequestResult> {
  const privateKey = await privateKeyPromise
  const token = await new SignJWT({ orgId: params.orgId, scope: 'inscription' })
    .setProtectedHeader({ alg: 'EdDSA' })
    .setIssuedAt()
    .setExpirationTime('2m')
    .setAudience('svc-gestion')
    .sign(privateKey)

  const response = await fetchWithTimeout(
    `${env.get('SVC_GESTION_BASE_URL')}/payment-requests/${originalPaymentRequestId}/retry`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        serviceId: params.serviceId,
        sourceReference: params.sourceReference,
        amountCents: params.amountCents,
        objectLabel: params.objectLabel,
        payerEmail: params.payerEmail,
        frontRedirectUrl: params.frontRedirectUrl,
        webhookUrl: `${env.get('SELF_BASE_URL')}/payment-webhooks`,
      }),
    }
  )

  if (!response.ok) {
    let body: unknown = null
    try {
      body = await response.json()
    } catch {
      body = null
    }
    throw new SvcGestionError(response.status, body)
  }

  const { data } = (await response.json()) as { data: PaymentRequestResult }
  return data
}
