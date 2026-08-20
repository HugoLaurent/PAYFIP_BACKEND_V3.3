import type { SaisiePaiementParams } from '#services/payfip/types'

export const PAYFIP_NAMESPACE =
  'http://securite.service.tpa.cp.finances.gouv.fr/services/mas_securite/contrat_paiement_securise/PaiementSecuriseService'

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function buildCreerPaiementEnvelope(p: SaisiePaiementParams): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="${PAYFIP_NAMESPACE}">
  <soapenv:Body>
    <tns:creerPaiementSecurise>
      <arg0>
        <numcli>${escapeXml(p.numcli)}</numcli>
        <exer>${p.exer}</exer>
        <refdet>${escapeXml(p.reference)}</refdet>
        <objet>${escapeXml(p.objectLabel)}</objet>
        <montant>${p.amountCents}</montant>
        <mel>${escapeXml(p.payerEmail)}</mel>
        <saisie>${p.saisie}</saisie>
        <urlnotif>${escapeXml(p.urlNotif)}</urlnotif>
        <urlredirect>${escapeXml(p.urlRedirect)}</urlredirect>
      </arg0>
    </tns:creerPaiementSecurise>
  </soapenv:Body>
</soapenv:Envelope>`
}

/**
 * recupererDetailPaiementSecurise — un seul champ, même correction de nom
 * et même wrapper <arg0> que creerPaiementSecurise (voir ci-dessus).
 *
 * Casse du champ confirmée contre le serveur réel : <idOp> avec un O
 * majuscule, pas <idop>. Avec la minuscule, PayFiP répond une
 * FonctionnelleErreur "P1 : IdOp incorrect." — même pour un idOp qu'il
 * vient tout juste de nous fournir lui-même via creerPaiementSecurise.
 * Piège d'autant plus sournois que ce cas était auparavant absorbé sans
 * bruit dans le statut 'unknown' (voir real_client.ts), indiscernable
 * d'un simple P5 "résultat pas encore connu".
 */
export function buildRecupererDetailEnvelope(idOp: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="${PAYFIP_NAMESPACE}">
  <soapenv:Body>
    <tns:recupererDetailPaiementSecurise>
      <arg0>
        <idOp>${escapeXml(idOp)}</idOp>
      </arg0>
    </tns:recupererDetailPaiementSecurise>
  </soapenv:Body>
</soapenv:Envelope>`
}
