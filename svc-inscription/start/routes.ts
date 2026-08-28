
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const OtpsController = () => import('#controllers/otps_controller')
const EventsController = () => import('#controllers/events_controller')
const RegistrationsController = () => import('#controllers/registrations_controller')

router.get('/health', () => {
  return { status: 'ok', service: 'svc-inscription' }
})

router
  .group(() => {
    router.post('/otp/request', [OtpsController, 'request'])
    router.post('/otp/verify', [OtpsController, 'verify'])

    router.get('/events', [EventsController, 'index'])
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
    router.post('/registrations/:id/review', [RegistrationsController, 'review'])
    router.get('/registrations/:id/documents/:documentId', [
      RegistrationsController,
      'downloadDocument',
    ])
  })
  .use(middleware.internalAuth())
