import vine from '@vinejs/vine'

// Les deux champs sont toujours envoyés ensemble (formulaire Paramètres) :
// email null = plus d'adresse (les inscriptions avec pièces sont alors
// indisponibles), cc [] = aucune copie.
export const updateServiceSettingsValidator = vine.compile(
  vine.object({
    documentContactEmail: vine.string().trim().toLowerCase().email().maxLength(255).nullable(),
    documentContactCc: vine.array(vine.string().trim().toLowerCase().email().maxLength(255)).maxLength(4),
  })
)
