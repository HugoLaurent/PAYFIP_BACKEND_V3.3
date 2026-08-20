
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const PaymentRequestsController = () => import('#controllers/payment_requests_controller')
const PayfipCallbacksController = () => import('#controllers/payfip_callbacks_controller')

router.get('/health', () => {
  return { status: 'ok', service: 'svc-gestion' }
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
