import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import env from '#start/env'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

const keyPromise = Promise.resolve(Buffer.from(env.get('TENANT_DB_CREDENTIALS_KEY'), 'base64'))

/**
 * Chiffre un mot de passe DB tenant avant stockage en base
 * (tenant_databases.db_password_enc) — jamais en clair au repos.
 * Format : base64(iv[12] | authTag[16] | ciphertext).
 */
export async function encryptTenantDbPassword(plaintext: string): Promise<string> {
  const key = await keyPromise
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64')
}

/**
 * Déchiffre un mot de passe DB tenant — appelé uniquement au moment de
 * répondre à un appel interne authentifié (scope 'tenant-registry'), jamais
 * stocké en clair, jamais loggé.
 */
export async function decryptTenantDbPassword(encoded: string): Promise<string> {
  const key = await keyPromise
  const raw = Buffer.from(encoded, 'base64')
  const iv = raw.subarray(0, IV_LENGTH)
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + 16)
  const ciphertext = raw.subarray(IV_LENGTH + 16)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf-8')
}
