import * as Sentry from '@sentry/node'
import env from '#start/env'

const dsn = env.get('GLITCHTIP_DSN')
if (dsn) {
  Sentry.init({ dsn, environment: env.get('NODE_ENV'), tracesSampleRate: 0 })
}
