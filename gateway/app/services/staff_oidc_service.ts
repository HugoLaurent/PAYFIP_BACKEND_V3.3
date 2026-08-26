import { randomBytes } from 'node:crypto'
import { SignJWT, jwtVerify, createRemoteJWKSet } from 'jose'
import env from '#start/env'

const issuer = env.get('AUTHENTIK_ISSUER')
const clientId = env.get('AUTHENTIK_CLIENT_ID')
const clientSecret = env.get('AUTHENTIK_CLIENT_SECRET')
const redirectUri = env.get('AUTHENTIK_REDIRECT_URI')
const stateSecret = new TextEncoder().encode(env.get('STAFF_JWT_SECRET'))

interface OidcDiscovery {
  authorization_endpoint: string
  token_endpoint: string
  jwks_uri: string
}

// authorize/token sont des endpoints globaux à l'instance Authentik, pas
// dérivables de l'issuer (propre à chaque application) par simple
// concaténation — on passe par la découverte standard, mise en cache après
// le premier appel (elle ne change pas en cours de vie du processus).
let discoveryPromise: Promise<OidcDiscovery> | null = null
function discovery(): Promise<OidcDiscovery> {
  if (!discoveryPromise) {
    discoveryPromise = fetch(`${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`).then(
      (res) => {
        if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`)
        return res.json() as Promise<OidcDiscovery>
      }
    )
  }
  return discoveryPromise
}

let jwksPromise: Promise<ReturnType<typeof createRemoteJWKSet>> | null = null
function jwks() {
  if (!jwksPromise) {
    jwksPromise = discovery().then((d) => createRemoteJWKSet(new URL(d.jwks_uri)))
  }
  return jwksPromise
}

export interface StaffOidcState {
  nonce: string
}

// L'état OAuth2 (`state`) sert normalement à la fois de protection CSRF et
// de corrélation avec la requête d'origine. La Gateway n'a pas de store de
// session — on le remplace par un JWT auto-signé, à courte durée de vie,
// que l'on vérifie tel quel au retour d'Authentik plutôt que de le
// comparer à une valeur conservée côté serveur.
export async function signOidcState(nonce: string): Promise<string> {
  return new SignJWT({ nonce })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(stateSecret)
}

export async function verifyOidcState(state: string): Promise<StaffOidcState | null> {
  try {
    const { payload } = await jwtVerify(state, stateSecret, { algorithms: ['HS256'] })
    if (typeof payload.nonce !== 'string') return null
    return { nonce: payload.nonce }
  } catch {
    return null
  }
}

export function generateNonce(): string {
  return randomBytes(16).toString('hex')
}

export async function buildAuthorizeUrl(state: string, nonce: string): Promise<string> {
  const { authorization_endpoint } = await discovery()
  const url = new URL(authorization_endpoint)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email profile')
  url.searchParams.set('state', state)
  url.searchParams.set('nonce', nonce)
  return url.toString()
}

export interface StaffIdentity {
  sub: string
  email: string
  name: string | null
}

export async function completeOidcLogin(
  code: string,
  expectedNonce: string
): Promise<StaffIdentity | null> {
  const { token_endpoint } = await discovery()

  const tokenRes = await fetch(token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret.release(),
    }),
  })

  if (!tokenRes.ok) return null

  const tokenBody = (await tokenRes.json()) as { id_token?: string }
  if (!tokenBody.id_token) return null

  let claims: Record<string, unknown>
  try {
    const { payload } = await jwtVerify(tokenBody.id_token, await jwks(), {
      issuer,
      audience: clientId,
      algorithms: ['RS256'],
    })
    claims = payload
  } catch {
    return null
  }

  if (claims.nonce !== expectedNonce) return null
  if (typeof claims.sub !== 'string' || typeof claims.email !== 'string') return null

  // Le contrôle d'appartenance au groupe payfip-staff est fait côté
  // Authentik (binding sur l'application, "Failure Result: Don't Pass") —
  // pas ici. Ce provider n'expose pas de scope "groups" (voir
  // scopes_supported dans le .well-known), donc un id_token valide ne
  // porte jamais ce claim ; exiger sa présence bloquerait toute connexion,
  // légitime ou non.
  return {
    sub: claims.sub,
    email: claims.email,
    name: typeof claims.name === 'string' ? claims.name : null,
  }
}
