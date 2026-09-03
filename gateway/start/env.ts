
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

  // SSO staff — Authentik (OIDC, Authorization Code). Remplace l'ancienne
  // clé statique partagée : chaque membre du staff se connecte avec son
  // propre compte Authentik, dans le groupe payfip-staff.
  AUTHENTIK_ISSUER: Env.schema.string({ format: 'url', tld: false }),
  AUTHENTIK_CLIENT_ID: Env.schema.string(),
  AUTHENTIK_CLIENT_SECRET: Env.schema.secret(),
  AUTHENTIK_REDIRECT_URI: Env.schema.string({ format: 'url', tld: false }),
  // Où renvoyer le navigateur une fois le token de session staff émis.
  STAFF_FRONTEND_REDIRECT_URL: Env.schema.string({ format: 'url', tld: false }),
  // Secret de signature du JWT de session staff émis par la Gateway après
  // vérification du id_token Authentik — indépendant de CLIENT_JWT_SECRET
  // (citoyens/agents) pour que la compromission de l'un n'affecte pas
  // l'autre périmètre.
  STAFF_JWT_SECRET: Env.schema.string(),

  GATEWAY_ALLOWED_ORIGINS: Env.schema.string(),

  // Suivi d'erreurs (GlitchTip, self-hosted, compatible Sentry) — absent en
  // dev/test, le SDK reste inerte plutôt que de faire échouer le démarrage.
  GLITCHTIP_DSN: Env.schema.string.optional(),

  SVC_AUTH_BASE_URL: Env.schema.string({ format: 'url', tld: false }),
  SVC_GESTION_BASE_URL: Env.schema.string({ format: 'url', tld: false }),
  SVC_BILLETTERIE_BASE_URL: Env.schema.string({ format: 'url', tld: false }),
  SVC_FACTURES_BASE_URL: Env.schema.string({ format: 'url', tld: false }),
  SVC_MAIL_BASE_URL: Env.schema.string({ format: 'url', tld: false }),
  SVC_INSCRIPTION_BASE_URL: Env.schema.string({ format: 'url', tld: false }),

  // Mode démo — widget de connexion rapide (staff/admin fictifs) pour les
  // démos commerciales, désactivé par défaut. Voir demo_controller.ts :
  // absent/'false' fait 404 toutes les routes /demo/*.
  DEMO_MODE: Env.schema.boolean.optional(),
  DEMO_ADMIN_EMAIL: Env.schema.string.optional(),
  DEMO_ADMIN_PASSWORD: Env.schema.string.optional(),
  DEMO_BILLETTERIE_PATH: Env.schema.string.optional(),
  DEMO_INSCRIPTION_PATH: Env.schema.string.optional(),
  DEMO_FACTURES_PATH: Env.schema.string.optional(),
  DEMO_CITIZEN_EMAIL: Env.schema.string.optional(),
  DEMO_CITIZEN_FIRST_NAME: Env.schema.string.optional(),
  DEMO_CITIZEN_LAST_NAME: Env.schema.string.optional(),
})
