
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AuthController = () => import('#controllers/auth_controller')
const ProfileController = () => import('#controllers/profile_controller')
const BilletteriePublicsController = () => import('#controllers/billetterie_publics_controller')
const BilletterieAgentsController = () => import('#controllers/billetterie_agents_controller')
const PaiementPublicsController = () => import('#controllers/paiement_publics_controller')
const FacturesPublicsController = () => import('#controllers/factures_publics_controller')
const StaffController = () => import('#controllers/staff_controller')
const StaffAuthController = () => import('#controllers/staff_auth_controller')
const ServicesPublicsController = () => import('#controllers/services_publics_controller')

router.get('/health', () => {
  return { status: 'ok', service: 'gateway' }
})

router.get('/staff/auth/login', [StaffAuthController, 'login'])
router.get('/staff/auth/callback', [StaffAuthController, 'callback'])

router.post('/auth/login', [AuthController, 'login']).use(middleware.loginRateLimit())
router.post('/auth/refresh', [AuthController, 'refresh']).use(middleware.clientAuth())
router.get('/auth/me', [ProfileController, 'show']).use(middleware.clientAuth())
router.patch('/auth/me', [ProfileController, 'updateProfile']).use(middleware.clientAuth())
router
  .patch('/auth/me/password', [ProfileController, 'changeOwnPassword'])
  .use(middleware.clientAuth())
router.get('/auth/users', [ProfileController, 'listUsers']).use(middleware.clientAuth())
router.post('/auth/users', [ProfileController, 'createUser']).use(middleware.clientAuth())
router.patch('/auth/users/:id', [ProfileController, 'updateUser']).use(middleware.clientAuth())
router.delete('/auth/users/:id', [ProfileController, 'deleteUser']).use(middleware.clientAuth())
router
  .patch('/auth/users/:id/password', [ProfileController, 'resetUserPassword'])
  .use(middleware.clientAuth())
router.get('/auth/services', [ProfileController, 'listServices']).use(middleware.clientAuth())
router.get('/auth/services/:id', [ProfileController, 'getService']).use(middleware.clientAuth())
router
  .patch('/auth/services/:id', [ProfileController, 'updateService'])
  .use(middleware.clientAuth())
router
  .post('/auth/services/:id/closures', [ProfileController, 'createServiceClosure'])
  .use(middleware.clientAuth())
router
  .delete('/auth/services/:id/closures/:closureId', [ProfileController, 'deleteServiceClosure'])
  .use(middleware.clientAuth())
router
  .post('/auth/services/:id/logo', [ProfileController, 'uploadServiceLogo'])
  .use(middleware.clientAuth())
router
  .post('/auth/services/:id/cover', [ProfileController, 'uploadServiceCover'])
  .use(middleware.clientAuth())
router
  .delete('/auth/services/:id/cover', [ProfileController, 'deleteServiceCover'])
  .use(middleware.clientAuth())
router.get('/services/:id/logo', [ServicesPublicsController, 'logo'])
router.get('/services/:id/cover', [ServicesPublicsController, 'cover'])

router.post('/paiement/payfip/notify', [PaiementPublicsController, 'notify'])
router.route('/paiement/payfip/return', ['GET', 'POST'], [PaiementPublicsController, 'returnCallback'])
router.get('/paiement/status/:idop', [PaiementPublicsController, 'status'])

router.get('/billetterie/services/lookup/:slug', [
  BilletteriePublicsController,
  'serviceLookup',
])
router.post('/billetterie/otp/request', [BilletteriePublicsController, 'otpRequest'])
router.post('/billetterie/otp/verify', [BilletteriePublicsController, 'otpVerify'])
router.get('/billetterie/tariffs', [BilletteriePublicsController, 'tariffs'])
router.post('/billetterie/orders', [BilletteriePublicsController, 'createOrder'])
router.get('/billetterie/orders/by-reference/:reference/tickets', [
  BilletteriePublicsController,
  'orderTicketsByReference',
])
router.get('/billetterie/orders/:id/tickets', [BilletteriePublicsController, 'orderTickets'])
router.get('/billetterie/orders/by-reference/:reference/tickets/pdf', [
  BilletteriePublicsController,
  'ticketsPdfByReference',
])
router.get('/billetterie/orders/:id/tickets/pdf', [BilletteriePublicsController, 'ticketsPdf'])
router.get('/billetterie/orders/by-reference/:reference/tickets/:ticketId/pdf', [
  BilletteriePublicsController,
  'ticketPdfByReference',
])
router.get('/billetterie/orders/:id/tickets/:ticketId/pdf', [
  BilletteriePublicsController,
  'ticketPdf',
])
router.post('/billetterie/orders/by-reference/:reference/retry-payment', [
  BilletteriePublicsController,
  'retryOrderPayment',
])

router.get('/factures/services/lookup/:slug', [FacturesPublicsController, 'serviceLookup'])
router.post('/factures/otp/request', [FacturesPublicsController, 'otpRequest'])
router.post('/factures/otp/verify', [FacturesPublicsController, 'otpVerify'])
router.post('/factures/verify', [FacturesPublicsController, 'verify'])
router.post('/factures/:id/pay', [FacturesPublicsController, 'pay'])
router.get('/factures/by-reference/:reference', [FacturesPublicsController, 'byReference'])
router.post('/factures/by-reference/:reference/retry-payment', [
  FacturesPublicsController,
  'retryInvoicePayment',
])

// AREGIE — authentifié par sa propre clé Bearer (aregieAuth côté service
// cible), pas par le JWT client ni interne. Jamais de session, un appel
// système à système.
router.post('/aregie/budget-codes', [BilletteriePublicsController, 'aregieDepositBudgetCodes'])
router.post('/aregie/invoices', [FacturesPublicsController, 'aregieDepositInvoices'])
router.get('/aregie/invoices/paid', [FacturesPublicsController, 'aregiePendingCollection'])
router.post('/aregie/invoices/collected', [
  FacturesPublicsController,
  'aregieAcknowledgeCollection',
])

router
  .group(() => {
    router.get('/billetterie/orders', [BilletterieAgentsController, 'listOrders'])
    router.get('/billetterie/orders/stats', [BilletterieAgentsController, 'orderStats'])
    router.get('/billetterie/orders/:id/payment-attempts', [
      BilletterieAgentsController,
      'orderPaymentAttempts',
    ])
    router.post('/billetterie/orders/agent-sale', [BilletterieAgentsController, 'agentSale'])
    router.post('/billetterie/orders/:id/resend-confirmation', [
      BilletterieAgentsController,
      'resendConfirmation',
    ])
    router.get('/billetterie/orders/:id/agent-tickets-pdf', [
      BilletterieAgentsController,
      'agentTicketsPdf',
    ])
    router.post('/billetterie/tickets/scan', [BilletterieAgentsController, 'scanTicket'])
    router.post('/billetterie/orders/scan', [BilletterieAgentsController, 'scanOrder'])
    router.post('/billetterie/tickets/:id/reset-scan', [BilletterieAgentsController, 'resetScan'])
    router.get('/billetterie/scans', [BilletterieAgentsController, 'listScans'])
    router.get('/billetterie/services/:id/tariffs', [BilletterieAgentsController, 'listTariffs'])
    router.post('/billetterie/services/:id/tariffs', [BilletterieAgentsController, 'createTariff'])
    router.patch('/billetterie/tariffs/:id', [BilletterieAgentsController, 'updateTariff'])
    router.delete('/billetterie/tariffs/:id', [BilletterieAgentsController, 'deleteTariff'])
    router.get('/billetterie/budget-codes', [BilletterieAgentsController, 'listBudgetCodes'])
  })
  .use(middleware.clientAuth())

router
  .group(() => {
    router.get('/staff/organizations', [StaffController, 'listOrganizations'])
    router.post('/staff/organizations', [StaffController, 'createOrganization'])
    router.patch('/staff/organizations/:id', [StaffController, 'updateOrganization'])
    router.post('/staff/organizations/:id/services', [StaffController, 'createService'])
    router.get('/staff/services', [StaffController, 'listServices'])
    router.patch('/staff/services/:id', [StaffController, 'updateService'])
    router.get('/staff/users', [StaffController, 'listUsers'])
    router.get('/staff/orders', [StaffController, 'listOrders'])
    router.get('/staff/invoices', [StaffController, 'listInvoices'])
    router.get('/staff/payment-requests', [StaffController, 'listPaymentRequests'])
    router.get('/staff/emails', [StaffController, 'listEmails'])
  })
  .use(middleware.staffAuth())
