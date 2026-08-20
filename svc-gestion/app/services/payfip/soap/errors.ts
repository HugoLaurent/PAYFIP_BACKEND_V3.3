export class PayfipFunctionalError extends Error {
  constructor(
    public code: string,
    public libelle: string,
    public raw: Record<string, string | null>
  ) {
    super(`PayFiP erreur fonctionnelle ${code}: ${libelle}`)
  }
}

/** Panne côté PayFiP (TechDysfonctionnementErreur, code 999). */
export class PayfipTechnicalError extends Error {
  constructor(public raw: Record<string, string | null>) {
    super('PayFiP erreur technique (TechDysfonctionnementErreur)')
  }
}

/** Réseau : timeout, DNS, connexion refusée, ou réponse sans enveloppe SOAP exploitable. */
export class PayfipUnreachableError extends Error {}

/** Réponse reçue mais dont la forme ne correspond à aucun cas attendu. */
export class PayfipUnexpectedResponseError extends Error {}
