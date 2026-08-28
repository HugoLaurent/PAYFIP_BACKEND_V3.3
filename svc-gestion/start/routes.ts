
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { HealthChecks } from '@adonisjs/core/health'
import { DbCheck } from '@adonisjs/lucid/database'
import db from '@adonisjs/lucid/services/db'

const PaymentRequestsController = () => import('#controllers/payment_requests_controller')
const PayfipCallbacksController = () => import('#controllers/payfip_callbacks_controller')

const healthChecks = new HealthChecks().register([new DbCheck(db.connection())])

router.get('/health', async (ctx) => {
  const report = await healthChecks.run()
  return ctx.response.status(report.isHealthy ? 200 : 503).send({
    status: report.isHealthy ? 'ok' : 'error',
    service: 'svc-gestion',
    checks: report.checks.map((c) => ({ name: c.name, status: c.status })),
  })
})

router.post('/payfip/notify', [PayfipCallbacksController, 'notify'])
router.route('/payfip/return', ['GET', 'POST'], [PayfipCallbacksController, 'return'])

router
  .group(() => {
    router.get('/payment-requests/staff', [PaymentRequestsController, 'staffIndex'])
    router.post('/payment-requests', [PaymentRequestsController, 'store'])
    router.post('/payment-requests/:id/retry', [PaymentRequestsController, 'retry'])
    router.get('/payment-requests/by-reference/:reference', [
      PaymentRequestsController,
      'attemptsByReference',
    ])
    router.get('/payfip/status/:idop', [PaymentRequestsController, 'status'])
  })
  .use(middleware.internalAuth())
