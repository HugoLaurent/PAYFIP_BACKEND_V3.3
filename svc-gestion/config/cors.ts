import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/cors'

export default defineConfig({
  enabled: true,
  origin: app.inDev ? true : [],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  headers: true,
  exposeHeaders: [],
  credentials: false,
  maxAge: 90,
})
