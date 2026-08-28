
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { HealthChecks } from '@adonisjs/core/health'
import { DbCheck } from '@adonisjs/lucid/database'
import db from '@adonisjs/lucid/services/db'

const OtpsController = () => import('#controllers/otps_controller')
const TariffsController = () => import('#controllers/tariffs_controller')
const OrdersController = () => import('#controllers/orders_controller')
const TicketsController = () => import('#controllers/tickets_controller')
const AregieController = () => import('#controllers/aregie_controller')

const healthChecks = new HealthChecks().register([new DbCheck(db.connection())])

router.get('/health', async (ctx) => {
  const report = await healthChecks.run()
  return ctx.response.status(report.isHealthy ? 200 : 503).send({
    status: report.isHealthy ? 'ok' : 'error',
    service: 'svc-billetterie',
    checks: report.checks.map((c) => ({ name: c.name, status: c.status })),
  })
})

router
  .group(() => {
    router.post('/payment-webhooks', [OrdersController, 'paymentWebhook'])
    router.post('/otp/request', [OtpsController, 'request'])
    router.post('/otp/verify', [OtpsController, 'verify'])
    router.get('/tariffs', [TariffsController, 'index'])
    router.post('/services/:id/tariffs', [TariffsController, 'store'])
    router.patch('/tariffs/:id', [TariffsController, 'update'])
    router.delete('/tariffs/:id', [TariffsController, 'destroy'])
    router.get('/budget-codes', [TariffsController, 'listBudgetCodes'])
    router.get('/orders', [OrdersController, 'index'])
    router.get('/orders/staff', [OrdersController, 'staffIndex'])
    router.get('/orders/stats', [OrdersController, 'stats'])
    router.post('/orders', [OrdersController, 'store'])
    router.post('/orders/agent-sale', [OrdersController, 'agentSale'])
    router.post('/orders/scan', [OrdersController, 'scanOrder'])
    router.post('/orders/:id/resend-confirmation', [OrdersController, 'resendConfirmation'])
    router.get('/orders/:id/agent-tickets-pdf', [OrdersController, 'agentTicketsPdf'])
    router.get('/orders/by-reference/:reference/tickets', [OrdersController, 'ticketsByReference'])
    router.post('/orders/by-reference/:reference/retry-payment', [
      OrdersController,
      'retryPayment',
    ])
    router.get('/orders/:id/tickets', [OrdersController, 'tickets'])
    router.get('/orders/:id/payment-attempts', [OrdersController, 'paymentAttempts'])
    router.get('/orders/by-reference/:reference/tickets/pdf', [
      OrdersController,
      'ticketsPdfByReference',
    ])
    router.get('/orders/:id/tickets/pdf', [OrdersController, 'ticketsPdf'])
    router.get('/orders/by-reference/:reference/tickets/:ticketId/pdf', [
      OrdersController,
      'ticketPdfByReference',
    ])
    router.get('/orders/:id/tickets/:ticketId/pdf', [OrdersController, 'ticketPdf'])
    router.post('/tickets/scan', [TicketsController, 'scan'])
    router.post('/tickets/:id/reset-scan', [TicketsController, 'resetScan'])
    router.get('/scans', [TicketsController, 'index'])
  })
  .use(middleware.internalAuth())

router
  .group(() => {
    router.post('/aregie/budget-codes', [AregieController, 'deposit'])
  })
  .use(middleware.aregieAuth())
