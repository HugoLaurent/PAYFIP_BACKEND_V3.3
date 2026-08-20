
import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),

  GATEWAY_JWT_PRIVATE_KEY: Env.schema.string(),

  CLIENT_JWT_SECRET: Env.schema.string(),

  STAFF_API_KEY: Env.schema.string(),

  GATEWAY_ALLOWED_ORIGINS: Env.schema.string(),

  SVC_AUTH_BASE_URL: Env.schema.string({ format: 'url', tld: false }),
  SVC_GESTION_BASE_URL: Env.schema.string({ format: 'url', tld: false }),
  SVC_BILLETTERIE_BASE_URL: Env.schema.string({ format: 'url', tld: false }),
  SVC_FACTURES_BASE_URL: Env.schema.string({ format: 'url', tld: false }),
  SVC_MAIL_BASE_URL: Env.schema.string({ format: 'url', tld: false }),
})
