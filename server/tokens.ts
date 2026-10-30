import { createHmac, timingSafeEqual } from 'node:crypto'
import { FormError } from './validation.ts'

export const SESSION_TTL = 60 * 60 * 1000
export const RETENTION_MS = 7 * 24 * 60 * 60 * 1000
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export function digest(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

export function signSession(id: string, issuedAt: number, secret: string) {
  const payload = Buffer.from(JSON.stringify({ id, issuedAt })).toString('base64url')
  return `${payload}.${digest(payload, secret)}`
}

export function verifySession(token: unknown, secret: string, now = Date.now(), statusOnly = false) {
  if (typeof token !== 'string' || token.length > 512) throw new FormError('INVALID_SESSION', 403)
  const [payload, signature, extra] = token.split('.')
  const expected = digest(payload ?? '', secret)
  if (extra || !signature || signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new FormError('INVALID_SESSION', 403)
  let data: { id: string; issuedAt: number }
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) }
  catch { throw new FormError('INVALID_SESSION', 403) }
  if (!UUID_PATTERN.test(data.id) || !Number.isSafeInteger(data.issuedAt) || data.issuedAt > now ||
      now - data.issuedAt >= (statusOnly ? RETENTION_MS : SESSION_TTL)) throw new FormError('SESSION_EXPIRED', 410)
  return data
}
