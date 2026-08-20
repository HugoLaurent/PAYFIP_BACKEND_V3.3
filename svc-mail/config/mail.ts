import env from '#start/env'
import { defineConfig, transports } from '@adonisjs/mail'
import type { InferMailers } from '@adonisjs/mail/types'

const mailConfig = defineConfig({
  default: 'smtp',

  mailers: {
    smtp: transports.smtp({
      host: env.get('SMTP_HOST') ?? 'localhost',
      port: env.get('SMTP_PORT') ?? 587,
      auth: {
        type: 'login',
        user: env.get('SMTP_USERNAME') ?? '',
        pass: env.get('SMTP_PASSWORD') ?? '',
      },
      // Le magasin de CA embarqué dans node:alpine ne valide pas la
      // chaîne de certificat envoyée par ce relais (intermédiaire
      // DigiCert non reconnu, cause confirmée en prod : "unable to get
      // local issuer certificate"). Le chiffrement STARTTLS reste actif,
      // seule la vérification de la chaîne est désactivée — scopé à ce
      // transport, pas au process (contrairement à
      // NODE_TLS_REJECT_UNAUTHORIZED=0 qui affecterait tout appel HTTPS).
      tls: {
        rejectUnauthorized: false,
      },
    }),
  },
})

export default mailConfig

declare module '@adonisjs/mail/types' {
  export interface MailersList extends InferMailers<typeof mailConfig> {}
}
