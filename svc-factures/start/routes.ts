
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const InvoicesController = () => import('#controllers/invoices_controller')
const AregieController = () => import('#controllers/aregie_controller')
const OtpsController = () => import('#controllers/otps_controller')

router.get('/health', () => {
  return { status: 'ok', service: 'svc-factures' }
})

router
  .group(() => {
    router.post('/payment-webhooks', [InvoicesController, 'paymentWebhook'])
    router.post('/otp/request', [OtpsController, 'request'])
    router.post('/otp/verify', [OtpsController, 'verify'])
    router.get('/invoices/staff', [InvoicesController, 'staffIndex'])
    router.post('/invoices/verify', [InvoicesController, 'verify'])
    router.post('/invoices/:id/pay', [InvoicesController, 'pay'])
    router.get('/invoices/by-reference/:reference', [InvoicesController, 'byReference'])
    router.post('/invoices/by-reference/:reference/retry-payment', [
      InvoicesController,
      'retryPayment',
    ])
  })
  .use(middleware.internalAuth())

router
  .group(() => {
    router.post('/aregie/invoices', [AregieController, 'deposit'])
    router.get('/aregie/invoices/paid', [AregieController, 'pendingCollection'])
    router.post('/aregie/invoices/collected', [AregieController, 'acknowledgeCollection'])
  })
  .use(middleware.aregieAuth())
