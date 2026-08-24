
import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),

  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),

  GATEWAY_JWT_PUBLIC_KEY: Env.schema.string(),
  GESTION_JWT_PUBLIC_KEY: Env.schema.string(),
  FACTURES_JWT_PRIVATE_KEY: Env.schema.string(),

  SVC_GESTION_BASE_URL: Env.schema.string({ format: 'url', tld: false }),
  SVC_MAIL_BASE_URL: Env.schema.string({ format: 'url', tld: false }),
  SVC_AUTH_BASE_URL: Env.schema.string({ format: 'url', tld: false }),
  SELF_BASE_URL: Env.schema.string({ format: 'url', tld: false }),
  // Domaine public (pas l'URL interne docker) — pour construire le logo du
  // service embarqué dans l'email de confirmation de paiement.
  PAYFIP_PUBLIC_BASE_URL: Env.schema.string({ format: 'url', tld: false }),

  AREGIE_API_KEYS: Env.schema.string(),

  OTP_MODE: Env.schema.enum(['fake', 'real'] as const),
})
