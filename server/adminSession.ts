import { timingSafeEqual } from 'node:crypto'
import type { AdminConfig } from './adminConfig.ts'
import { digest } from './tokens.ts'
import { FormError } from './validation.ts'

const TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
export const ADMIN_SESSION_MS = 60 * 60 * 1000
const name = (config: AdminConfig) => config.secureCookies ? '__Secure-mycodx-admin' : 'mycodx_admin_dev'
const attributes = (config: AdminConfig) => `Path=/api/admin; HttpOnly; SameSite=Strict${config.secureCookies ? '; Secure' : ''}`

export function clearAdminCookie(config: AdminConfig) {
  return `${name(config)}=; ${attributes(config)}; Max-Age=0`
}

export function createAdminCookie(token: string, expiresIn: number, config: AdminConfig, now = Date.now()) {
  if (!TOKEN_PATTERN.test(token) || token.length > 3500 || !Number.isFinite(expiresIn) || expiresIn < 1) {
    throw new FormError('UNAVAILABLE', 503)
  }
  const maxAge = Math.min(Math.floor(expiresIn), ADMIN_SESSION_MS / 1000)
  const expiresAt = now + maxAge * 1000
  const value = `${token}~${expiresAt}`
  const signature = digest(`admin-session:${value}`, config.signingSecret)
  return { expiresAt, cookie: `${name(config)}=${value}~${signature}; ${attributes(config)}; Max-Age=${maxAge}` }
}

export function readAdminSession(request: Request, config: AdminConfig, now = Date.now()) {
  const cookies = (request.headers.get('cookie') ?? '').split(';').map(part => part.trim())
    .filter(part => part.startsWith(`${name(config)}=`))
  if (cookies.length !== 1) throw new FormError('AUTH_REQUIRED', 401)
  const value = cookies[0].slice(name(config).length + 1)
  if (value.length > 3700) throw new FormError('AUTH_REQUIRED', 401)
  const [token, expiry, signature, extra] = value.split('~')
  const expected = digest(`admin-session:${token}~${expiry}`, config.signingSecret)
  const expiresAt = Number(expiry)
  if (extra !== undefined || !TOKEN_PATTERN.test(token ?? '') || !signature || !/^[A-Za-z0-9_-]{43}$/.test(signature) ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ||
    !Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt > now + ADMIN_SESSION_MS) {
    throw new FormError('AUTH_REQUIRED', 401)
  }
  return { token, expiresAt }
}
