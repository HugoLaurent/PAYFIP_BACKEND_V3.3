import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AuthController = () => import('#controllers/auth_controller')
const ProfileController = () => import('#controllers/profile_controller')
const ServicesController = () => import('#controllers/services_controller')
const OrganizationsController = () => import('#controllers/organizations_controller')
const UsersController = () => import('#controllers/users_controller')

router.get('/health', () => {
  return { status: 'ok', service: 'svc-auth' }
})

router.post('/auth/login', [AuthController, 'login'])
router.get('/services/lookup/:slug', [ServicesController, 'lookupBySlug'])
router.get('/services/:id/logo', [ServicesController, 'showLogo'])
router.get('/services/:id/cover', [ServicesController, 'showCoverImage'])

router
  .group(() => {
    router.get('/me', [ProfileController, 'show'])
    router.patch('/me', [ProfileController, 'update'])
    router.patch('/me/password', [ProfileController, 'changePassword'])
    router.get('/services/:id/payfip-account', [ServicesController, 'payfipAccount'])
    router.get('/services/:id/status', [ServicesController, 'status'])
    router.get('/services/:id/label', [ServicesController, 'label'])
    router.get('/services/by-numcli/:numcli', [ServicesController, 'byNumcli'])

    router.get('/organizations', [OrganizationsController, 'index'])
    router.post('/organizations', [OrganizationsController, 'store'])
    router.patch('/organizations/:id', [OrganizationsController, 'update'])
    router.post('/organizations/:id/services', [ServicesController, 'store'])
    router.get('/services', [ServicesController, 'index'])
    router.get('/services/:id', [ServicesController, 'show'])
    router.patch('/services/:id', [ServicesController, 'update'])
    router.post('/services/:id/closures', [ServicesController, 'createClosure'])
    router.delete('/services/:id/closures/:closureId', [ServicesController, 'deleteClosure'])
    router.post('/services/:id/logo', [ServicesController, 'uploadLogo'])
    router.post('/services/:id/cover', [ServicesController, 'uploadCoverImage'])
    router.delete('/services/:id/cover', [ServicesController, 'deleteCoverImage'])
    router.get('/users', [UsersController, 'index'])
    router.post('/users', [UsersController, 'store'])
    router.patch('/users/:id', [UsersController, 'update'])
    router.patch('/users/:id/password', [UsersController, 'resetPassword'])
    router.delete('/users/:id', [UsersController, 'destroy'])
  })
  .use(middleware.internalAuth())
