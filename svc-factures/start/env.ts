
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

  // Filet de sécurité pour OTP_MODE=fake : une valeur banale ("true", "1")
  // survivrait sans qu'on la remarque à un copier-coller de config vers la
  // vraie prod. Celle-ci est volontairement explicite pour être repérée
  // immédiatement dans une revue des variables d'environnement.
  ALLOW_INSECURE_OTP_MODE: Env.schema.string.optional(),

  // Suivi d'erreurs (GlitchTip, self-hosted, compatible Sentry) — absent en
  // dev/test, le SDK reste inerte plutôt que de faire échouer le démarrage.
  GLITCHTIP_DSN: Env.schema.string.optional(),

  // Alerte Teams envoyée quand l'email de confirmation facture abandonne
  // après 24h d'échecs (voir invoice_confirmation_mail_service.ts) —
  // absent en dev, l'alerte reste inerte.
  OPS_ALERT_WEBHOOK_URL: Env.schema.string.optional(),
})
