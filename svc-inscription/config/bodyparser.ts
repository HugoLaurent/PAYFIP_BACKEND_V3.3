import { defineConfig } from '@adonisjs/core/bodyparser'

const bodyParserConfig = defineConfig({
  allowedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],

  form: {
    convertEmptyStringsToNull: true,

    types: ['application/x-www-form-urlencoded'],
  },

  json: {
    convertEmptyStringsToNull: true,

    types: [
      'application/json',
      'application/json-patch+json',
      'application/vnd.api+json',
      'application/csp-report',
    ],
  },

  multipart: {
    autoProcess: true,

    convertEmptyStringsToNull: true,

    processManually: [],

    // Cinq justificatifs à 8 Mo max chacun (voir registration_documents,
    // parcours C) — 40 Mo de marge pour ne pas rejeter un multipart valide
    // avant même que le contrôleur ait pu vérifier la taille par fichier.
    limit: '40mb',

    types: ['multipart/form-data'],
  },
})

export default bodyParserConfig
