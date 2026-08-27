
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
  BILLETTERIE_JWT_PUBLIC_KEY: Env.schema.string(),
  FACTURES_JWT_PUBLIC_KEY: Env.schema.string(),
  INSCRIPTION_JWT_PUBLIC_KEY: Env.schema.string(),

  GESTION_JWT_PRIVATE_KEY: Env.schema.string(),
  SVC_AUTH_BASE_URL: Env.schema.string({ format: 'url', tld: false }),

  FRONT_ALLOWED_ORIGINS: Env.schema.string(),

  PAYFIP_MODE: Env.schema.enum(['fake', 'real'] as const),
  PAYFIP_PUBLIC_BASE_URL: Env.schema.string({ format: 'url', tld: false }),
  FAKE_PAYFIP_BASE_URL: Env.schema.string.optional({ format: 'url', tld: false }),
  PAYFIP_SOAP_URL: Env.schema.string.optional({ format: 'url', tld: false }),
  PAYFIP_SOAP_TIMEOUT_MS: Env.schema.number.optional(),

  // Suivi d'erreurs (GlitchTip, self-hosted, compatible Sentry) — absent en
  // dev/test, le SDK reste inerte plutôt que de faire échouer le démarrage.
  GLITCHTIP_DSN: Env.schema.string.optional(),

  // Alerte Teams envoyée quand un webhook abandonne après 24h d'échecs
  // (voir webhook_dispatcher_service.ts) — absent en dev, l'alerte reste
  // inerte.
  OPS_ALERT_WEBHOOK_URL: Env.schema.string.optional(),
})
