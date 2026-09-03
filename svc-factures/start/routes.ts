
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { HealthChecks } from '@adonisjs/core/health'
import { DbCheck } from '@adonisjs/lucid/database'
import db from '@adonisjs/lucid/services/db'

const InvoicesController = () => import('#controllers/invoices_controller')
const AregieController = () => import('#controllers/aregie_controller')
const OtpsController = () => import('#controllers/otps_controller')

const healthChecks = new HealthChecks().register([new DbCheck(db.connection())])

router.get('/health', async (ctx) => {
  const report = await healthChecks.run()
  return ctx.response.status(report.isHealthy ? 200 : 503).send({
    status: report.isHealthy ? 'ok' : 'error',
    service: 'svc-factures',
    checks: report.checks.map((c) => ({ name: c.name, status: c.status })),
  })
})

router
  .group(() => {
    router.post('/payment-webhooks', [InvoicesController, 'paymentWebhook'])
    router.post('/otp/request', [OtpsController, 'request'])
    router.post('/otp/verify', [OtpsController, 'verify'])
    router.get('/invoices/staff', [InvoicesController, 'staffIndex'])
    router.get('/invoices/staff/:id/payment-attempts', [InvoicesController, 'paymentAttempts'])
    router.post('/invoices/verify', [InvoicesController, 'verify'])
    router.post('/invoices/:code/pay', [InvoicesController, 'pay'])
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
