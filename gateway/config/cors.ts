import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/cors'
import env from '#start/env'

const allowedOrigins = env
  .get('GATEWAY_ALLOWED_ORIGINS')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const corsConfig = defineConfig({
  enabled: true,

  origin: app.inDev ? true : allowedOrigins,

  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],

  headers: true,

  exposeHeaders: [],

  credentials: true,

  maxAge: 90,
})

export default corsConfig
