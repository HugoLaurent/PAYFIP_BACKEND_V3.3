
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const EmailsController = () => import('#controllers/emails_controller')
const StaffController = () => import('#controllers/staff_controller')

router.get('/health', () => {
  return { status: 'ok', service: 'svc-mail' }
})

router
  .group(() => {
    router.post('/emails', [EmailsController, 'send'])
    router.get('/emails/staff', [StaffController, 'index'])
  })
  .use(middleware.internalAuth())
