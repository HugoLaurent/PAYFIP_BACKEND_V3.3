export type DecodedKind = 'success' | 'functionalError' | 'technicalError'

export interface DecodedSoapResponse {
  kind: DecodedKind
  fields: Record<string, string | null>
}

export function extractTag(xml: string, tagName: string): string | null {
  const re = new RegExp(`<(?:\\w+:)?${tagName}\\b[^>]*>([^<]*)</(?:\\w+:)?${tagName}>`, 'i')
  const match = xml.match(re)
  return match ? match[1] : null
}

function extractFields(xml: string, tags: string[]): Record<string, string | null> {
  return Object.fromEntries(tags.map((tag) => [tag, extractTag(xml, tag)]))
}

const FAULT_FIELDS = ['code', 'libelle', 'descriptif', 'message', 'severite']

/**
 * Distingue succès / FonctionnelleErreur / TechDysfonctionnementErreur par
 * simple détection de sous-chaîne avant extraction ciblée — suffisant ici
 * car ces trois cas ont des noms de balises mutuellement exclusifs et
 * jamais ambigus dans les exemples du guide. Un Fault dont le detail
 * n'est ni l'un ni l'autre (erreur de transport générique) est traité
 * comme technique par défaut (fail-safe).
 *
 * `successFields` est fourni par l'appelant : real_client.ts sait déjà
 * quels champs il attend selon l'opération en cours. Comme l'extraction
 * se fait par nom de balise et non par chemin, l'ambiguïté documentée sur
 * la présence ou non d'un wrapper <return> (confirmée pour
 * recupererDetailPaiementSecuriseResponse, pas pour
 * creerPaiementSecuriseResponse) n'a pas d'impact : idop est trouvé que
 * la réponse soit `<idop>` directement sous <Body> ou sous <return>.
 */
export function parseSoapResponse(xml: string, successFields: string[]): DecodedSoapResponse {
  if (xml.includes('TechDysfonctionnementErreur')) {
    return { kind: 'technicalError', fields: extractFields(xml, FAULT_FIELDS) }
  }
  if (xml.includes('FonctionnelleErreur')) {
    return { kind: 'functionalError', fields: extractFields(xml, FAULT_FIELDS) }
  }
  if (xml.includes('<soapenv:Fault>') || xml.includes('<Fault>') || xml.includes(':Fault>')) {
    return { kind: 'technicalError', fields: { faultstring: extractTag(xml, 'faultstring') } }
  }
  return { kind: 'success', fields: extractFields(xml, successFields) }
}
