
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

  BILLETTERIE_JWT_PUBLIC_KEY: Env.schema.string(),
  FACTURES_JWT_PUBLIC_KEY: Env.schema.string(),
  GATEWAY_JWT_PUBLIC_KEY: Env.schema.string(),
  INSCRIPTION_JWT_PUBLIC_KEY: Env.schema.string(),

  MAIL_MODE: Env.schema.enum(['fake', 'real'] as const),
  // Service AREGIE Mail (voir CLIENT_GUIDE.md du dépôt AREGIE_MAIL) — la
  // clé API est saisie par un admin depuis le back office et vit chiffrée
  // en base (aregie_mail_settings_service.ts), pas ici. L'URL, elle,
  // n'est pas un secret et reste une variable d'environnement.
  AREGIE_MAIL_API_URL: Env.schema.string.optional(),
  MAIL_TEST_OVERRIDE_EMAIL: Env.schema.string.optional(),

  // Suivi d'erreurs (GlitchTip, self-hosted, compatible Sentry) — absent en
  // dev/test, le SDK reste inerte plutôt que de faire échouer le démarrage.
  GLITCHTIP_DSN: Env.schema.string.optional(),

  // Alerte Teams envoyée quand un envoi abandonne après 24h d'échecs
  // (voir email_dispatcher_service.ts) — absent en dev, l'alerte reste
  // inerte.
  OPS_ALERT_WEBHOOK_URL: Env.schema.string.optional(),
})
