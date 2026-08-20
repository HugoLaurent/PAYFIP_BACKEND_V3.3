import vine from '@vinejs/vine'

export const depositInvoicesValidator = vine.compile(
  vine.object({
    invoices: vine
      .array(
        vine.object({
          // Format AREGIE : NUMCLI;REFFACTURE;ETAT;MONTANT;DATE. Jamais
          // serviceId (notre id interne) : le numcli est résolu vers
          // l'organisme/service côté svc-auth au moment du dépôt.
          // objectLabel n'est pas fourni par AREGIE — généré à partir du
          // nom du service résolu (jamais un libellé métier potentiellement
          // sensible fourni tel quel). clientNumber n'est plus alimenté
          // par ce format, la colonne reste en base pour compatibilité.
          numcli: vine.string().trim().minLength(1),
          hospitalReference: vine.string().trim().minLength(1), // REFFACTURE
          aregieStatus: vine.string().trim().minLength(1), // ETAT
          amountCents: vine.number().positive(), // MONTANT
          fiscalYear: vine.number(), // DATE
        })
      )
      .minLength(1),
  })
)

export const acknowledgeCollectionValidator = vine.compile(
  vine.object({
    invoiceIds: vine.array(vine.number()).minLength(1),
  })
)
