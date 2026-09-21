import vine from '@vinejs/vine'

export const depositInvoicesValidator = vine.compile(
  vine.object({
    invoices: vine
      .array(
        vine.object({
          // Format AREGIE : NUMCLI;REFFACTURE;ETAT;MONTANT;DATE, plus le
          // link_code propre au service (configuré côté AREGIE à la
          // création du service — voir services_controller.ts#byLinkCode).
          // Jamais serviceId (notre id interne) : c'est le link_code qui
          // est résolu vers l'organisme/service côté svc-auth au moment du
          // dépôt — le numcli, lui, peut être partagé entre plusieurs
          // services d'un même organisme, donc plus utilisé pour router,
          // seulement revérifié (voir aregie_controller.ts#deposit).
          // objectLabel n'est pas fourni par AREGIE — généré à partir du
          // nom du service résolu (jamais un libellé métier potentiellement
          // sensible fourni tel quel). clientNumber n'est plus alimenté
          // par ce format, la colonne reste en base pour compatibilité.
          numcli: vine.string().trim().minLength(1),
          linkCode: vine.string().trim().minLength(1),
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
    // "<serviceId>:<invoiceId>" — l'id de facture seul n'est plus unique
    // globalement depuis le split par service (chaque service a sa
    // propre séquence d'id), voir pendingCollection().
    invoiceIds: vine.array(vine.string().regex(/^\d+:\d+$/)).minLength(1),
  })
)
