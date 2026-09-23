import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/core/http'

export const appUrl = env.get('APP_URL')

export const http = defineConfig({
  generateRequestId: true,

  allowMethodSpoofing: false,

  useAsyncLocalStorage: false,

  // Sans ça, request.ip() (utilisé par login_rate_limit_middleware.ts et
  // public_proof_rate_limit_middleware.ts pour clé de rate limit) retombe
  // sur le défaut 'loopback' — il ignore X-Forwarded-For envoyé par NPM
  // (reverse-proxy, réseau Docker proxy-net) et voit l'IP de NPM comme
  // pair TCP direct pour TOUTES les requêtes : tous les clients partagent
  // le même compteur, ~10 logins sur toute la plateforme suffisent à
  // bloquer tout le monde (429). 'uniquelocal' fait confiance aux plages
  // privées RFC1918 — sûr ici car la gateway n'est joignable directement
  // que depuis l'intérieur des réseaux Docker (aucun port publié à part
  // NPM, voir deploy/docker-compose.prod.yml) : un attaquant externe ne
  // peut pas ouvrir une connexion TCP directe pour falsifier l'en-tête.
  // Jamais `true` (ferait confiance à n'importe quel forwarded-for).
  trustProxy: 'uniquelocal',

  redirect: {
    forwardQueryString: false,
  },

  cookie: {
    domain: '',

    path: '/',

    maxAge: '2h',

    httpOnly: true,

    secure: app.inProduction,

    sameSite: 'lax',
  },
})
