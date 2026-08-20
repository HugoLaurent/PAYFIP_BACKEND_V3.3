import { defineConfig } from '@adonisjs/cors'

export default defineConfig({
  enabled: true,
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  headers: true,
  exposeHeaders: [],
  credentials: false,
  maxAge: 90,
})
