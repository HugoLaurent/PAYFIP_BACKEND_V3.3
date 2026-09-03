
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { HealthChecks } from '@adonisjs/core/health'
import { DbCheck } from '@adonisjs/lucid/database'
import db from '@adonisjs/lucid/services/db'

const OtpsController = () => import('#controllers/otps_controller')
const EventsController = () => import('#controllers/events_controller')
const RegistrationsController = () => import('#controllers/registrations_controller')

const healthChecks = new HealthChecks().register([new DbCheck(db.connection())])

router.get('/health', async (ctx) => {
  const report = await healthChecks.run()
  return ctx.response.status(report.isHealthy ? 200 : 503).send({
    status: report.isHealthy ? 'ok' : 'error',
    service: 'svc-inscription',
    checks: report.checks.map((c) => ({ name: c.name, status: c.status })),
  })
})

router
  .group(() => {
    router.post('/otp/request', [OtpsController, 'request'])
    router.post('/otp/verify', [OtpsController, 'verify'])

    router.get('/events', [EventsController, 'index'])
    // Avant '/events/:id' : sinon ':id' capture "pending-review-count".
    router.get('/events/pending-review-count', [EventsController, 'pendingReviewCount'])
    router.get('/events/by-slug/:slug', [EventsController, 'showBySlug'])
    router.get('/events/:id', [EventsController, 'show'])
    router.post('/services/:id/events', [EventsController, 'store'])
    router.patch('/events/:id', [EventsController, 'update'])
    router.post('/events/:id/cancel', [EventsController, 'cancel'])
    router.delete('/events/:id', [EventsController, 'destroy'])

    router.post('/registrations', [RegistrationsController, 'store'])
    router.post('/registrations/with-documents', [RegistrationsController, 'storeWithDocuments'])
    router.get('/registrations/by-reference/:reference', [RegistrationsController, 'showByReference'])
    router.get('/registrations/by-token/:accessToken', [RegistrationsController, 'showByToken'])
    router.post('/registrations/by-token/:accessToken/documents', [
      RegistrationsController,
      'replaceDocuments',
    ])
    router.post('/registrations/by-token/:accessToken/cancel', [
      RegistrationsController,
      'cancelByToken',
    ])
    router.post('/registrations/by-token/:accessToken/pay', [
      RegistrationsController,
      'payByToken',
    ])
    router.post('/registrations/by-token/:accessToken/retry-payment', [
      RegistrationsController,
      'retryPayment',
    ])
    router.get('/registrations/by-token/:accessToken/attestation', [
      RegistrationsController,
      'downloadAttestation',
    ])
    router.post('/payment-webhooks', [RegistrationsController, 'paymentWebhook'])

    router.get('/events/:id/registrations', [RegistrationsController, 'index'])
    router.get('/registrations/staff', [RegistrationsController, 'staffIndex'])
    router.get('/registrations/staff/:id/payment-attempts', [
      RegistrationsController,
      'paymentAttempts',
    ])
    router.post('/registrations/:id/review', [RegistrationsController, 'review'])
    router.post('/registrations/:id/resend-reminder', [RegistrationsController, 'resendReminder'])
    router.get('/registrations/:id/documents/:documentId', [
      RegistrationsController,
      'downloadDocument',
    ])
  })
  .use(middleware.internalAuth())
