export const ADMIN_PASSWORD_MIN = 12
export const ADMIN_PASSWORD_MAX = 72

// Do not trim or normalize passwords. Bound UTF-8 bytes as well as characters
// to avoid ambiguous passwords with bcrypt's 72-byte limit.
export function passwordChangeError(current: unknown, password: unknown, confirmation: unknown): string | null {
  if (typeof current !== 'string' || !current.length || current.length > 1024 ||
    typeof password !== 'string' || typeof confirmation !== 'string') return 'INVALID_FIELDS'
  if (Array.from(password).length < ADMIN_PASSWORD_MIN || !password.trim()) return 'PASSWORD_TOO_SHORT'
  if (new TextEncoder().encode(password).length > ADMIN_PASSWORD_MAX) return 'PASSWORD_TOO_LONG'
  if (password !== confirmation) return 'PASSWORD_MISMATCH'
  if (password === current) return 'PASSWORD_SAME'
  return null
}
