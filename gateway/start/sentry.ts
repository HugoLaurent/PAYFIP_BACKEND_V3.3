import * as Sentry from '@sentry/node'
import env from '#start/env'

// GLITCHTIP_DSN est optionnel — absent en dev/test, le SDK reste inerte
// (captureException devient un no-op) plutôt que de faire échouer le
// démarrage. Preload chargé en premier (voir adonisrc.ts) pour capter les
// erreurs le plus tôt possible dans le cycle de boot.
const dsn = env.get('GLITCHTIP_DSN')

if (dsn) {
  Sentry.init({
    dsn,
    environment: env.get('NODE_ENV'),
    tracesSampleRate: 0,
  })
}
