
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
  FACTURES_JWT_PUBLIC_KEY: Env.schema.string(),
  BILLETTERIE_JWT_PUBLIC_KEY: Env.schema.string(),

  // Suivi d'erreurs (GlitchTip, self-hosted, compatible Sentry) — absent en
  // dev/test, le SDK reste inerte plutôt que de faire échouer le démarrage.
  GLITCHTIP_DSN: Env.schema.string.optional(),
})
