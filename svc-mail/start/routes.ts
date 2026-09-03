
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { HealthChecks } from '@adonisjs/core/health'
import { DbCheck } from '@adonisjs/lucid/database'
import db from '@adonisjs/lucid/services/db'

const EmailsController = () => import('#controllers/emails_controller')
const StaffController = () => import('#controllers/staff_controller')

const healthChecks = new HealthChecks().register([new DbCheck(db.connection())])

router.get('/health', async (ctx) => {
  const report = await healthChecks.run()
  return ctx.response.status(report.isHealthy ? 200 : 503).send({
    status: report.isHealthy ? 'ok' : 'error',
    service: 'svc-mail',
    checks: report.checks.map((c) => ({ name: c.name, status: c.status })),
  })
})

router
  .group(() => {
    router.post('/emails', [EmailsController, 'send'])
    router.get('/emails/staff', [StaffController, 'index'])
    router.get('/emails/staff/:id', [StaffController, 'show'])
    router.get('/emails/example', [StaffController, 'example'])
  })
  .use(middleware.internalAuth())
