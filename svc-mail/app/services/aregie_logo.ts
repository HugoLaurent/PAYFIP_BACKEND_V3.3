import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const logoBase64 = readFileSync(
  fileURLToPath(new URL('../../resources/images/aregie-logo.png', import.meta.url))
).toString('base64')
