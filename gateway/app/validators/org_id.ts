import vine from '@vinejs/vine'

// Toutes les routes publiques proxient orgId (query ou body) tel quel dans
// le JWT interne minté pour le service cible. Non validé, une valeur
// manquante/malformée ("undefined", "NaN"...) atteint la requête SQL du
// service cible et sa vraie erreur Postgres remonte au client.
export const orgIdValidator = vine.compile(vine.object({ orgId: vine.number().positive() }))
