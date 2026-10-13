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

  // Plus aucun upload : les pièces justificatives sont envoyées par email
  // à l'organisme, pas à ce service (voir Event.documentContactEmail).
  multipart: {
    autoProcess: false,

    convertEmptyStringsToNull: true,

    processManually: [],

    limit: '1mb',

    types: [],
  },
})

export default bodyParserConfig
