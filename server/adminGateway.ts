import type { AdminConfig } from './adminConfig.ts'
import { boundedBytes, RECRUIT_BUCKET } from './supabase.ts'
import { EMAIL_PATTERN, FormError } from './validation.ts'
import { UUID_PATTERN } from './tokens.ts'
import { ServiceOperationError, serviceOperation } from './serviceDiagnostics.ts'

export interface AuthUser { id: string; email: string }
export interface DownloadGrant { bucket: string; path: string; filename: string; expires_in: number }
export interface AdminGateway {
  signIn(email: string, password: string): Promise<{ token: string; expiresIn: number }>
  getUser(token: string): Promise<AuthUser>
  updatePassword(token: string, currentPassword: string, password: string): Promise<void>
  signOut(token: string): Promise<void>
  signDownload(fileId: string, grant: DownloadGrant): Promise<string>
}

export function createAdminGateway(config: AdminConfig, fetcher: typeof fetch = fetch): AdminGateway {
  const request = (path: string, init: RequestInit, key: string) => {
    if (!config.enabled) throw new FormError('UNAVAILABLE', 503)
    return fetcher(`${config.supabaseUrl}${path}`, {
      ...init, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10_000),
      headers: { ...init.headers, apikey: key },
    })
  }
  const json = async (response: Response) => JSON.parse((await boundedBytes(response, 64 * 1024)).toString()) as Record<string, unknown>
  return {
    signIn: (email, password) => serviceOperation('supabase', 'auth_login', async () => {
      const response = await request('/auth/v1/token?grant_type=password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
      }, config.publishableKey)
      if (!response.ok) {
        await response.body?.cancel()
        if (response.status === 429) throw new FormError('RATE_LIMITED', 429)
        if ([400, 401, 403, 422].includes(response.status)) throw new FormError('LOGIN_FAILED', 401)
        throw new ServiceOperationError('supabase', 'auth_login', undefined, response.status)
      }
      const data = await json(response)
      if (typeof data.access_token !== 'string' || typeof data.expires_in !== 'number') throw new FormError('UNAVAILABLE', 503)
      // No refresh token is stored or returned. Expired sessions require sign-in.
      return { token: data.access_token, expiresIn: data.expires_in }
    }),
    getUser: token => serviceOperation('supabase', 'auth_user', async () => {
      const response = await request('/auth/v1/user', { method: 'GET', headers: { Authorization: `Bearer ${token}` } }, config.publishableKey)
      if (!response.ok) {
        await response.body?.cancel()
        if ([401, 403].includes(response.status)) throw new FormError('AUTH_REQUIRED', 401)
        throw new ServiceOperationError('supabase', 'auth_user', undefined, response.status)
      }
      const data = await json(response)
      if (typeof data.id !== 'string' || !UUID_PATTERN.test(data.id) ||
        typeof data.email !== 'string' || !EMAIL_PATTERN.test(data.email) || data.is_anonymous === true) {
        throw new FormError('AUTH_REQUIRED', 401)
      }
      return { id: data.id, email: data.email }
    }),
    updatePassword: (token, currentPassword, password) => serviceOperation('supabase', 'auth_password', async () => {
      const response = await request('/auth/v1/user', {
        method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, current_password: currentPassword }),
      }, config.publishableKey)
      if (response.ok) { await response.body?.cancel(); return }
      if (response.status === 429) { await response.body?.cancel(); throw new FormError('RATE_LIMITED', 429) }
      if (response.status === 401) { await response.body?.cancel(); throw new FormError('AUTH_REQUIRED', 401) }
      if ([400, 403, 422].includes(response.status)) {
        const data = await json(response)
        // Only fixed codes leave the adapter, never provider messages or bodies.
        const codes: Record<string, string> = {
          weak_password: 'PASSWORD_WEAK', same_password: 'PASSWORD_SAME',
          invalid_credentials: 'CURRENT_PASSWORD_INVALID',
          reauthentication_needed: 'PASSWORD_REAUTH_REQUIRED', reauthentication_not_valid: 'PASSWORD_REAUTH_REQUIRED',
          insufficient_aal: 'PASSWORD_REAUTH_REQUIRED',
        }
        throw new FormError(typeof data.code === 'string' ? codes[data.code] ?? 'PASSWORD_REJECTED' : 'PASSWORD_REJECTED')
      }
      await response.body?.cancel()
      throw new ServiceOperationError('supabase', 'auth_password', undefined, response.status)
    }),
    signOut: token => serviceOperation('supabase', 'auth_logout', async () => {
      const response = await request('/auth/v1/logout?scope=local', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }, config.publishableKey)
      await response.body?.cancel()
      if (!response.ok && ![401, 403].includes(response.status)) throw new ServiceOperationError('supabase', 'auth_logout', undefined, response.status)
    }),
    signDownload: (fileId, grant) => serviceOperation('supabase', 'storage_sign', async () => {
      const segments = typeof grant.path === 'string' ? grant.path.split('/') : []
      if (grant.bucket !== RECRUIT_BUCKET || segments.length !== 3 || segments[0] !== 'v1' ||
        !UUID_PATTERN.test(segments[1]) || !UUID_PATTERN.test(fileId) ||
        !['pdf', 'doc', 'docx', 'zip'].some(ext => segments[2] === `${fileId}.${ext}`) ||
        !Number.isInteger(grant.expires_in) || grant.expires_in < 1 || grant.expires_in > 60) {
        throw new FormError('UNAVAILABLE', 503)
      }
      const suffix = `/object/sign/${RECRUIT_BUCKET}/${grant.path}`
      const response = await request(`/storage/v1${suffix}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: grant.expires_in }),
      }, config.supabaseSecretKey)
      if (!response.ok) { await response.body?.cancel(); throw new ServiceOperationError('supabase', 'storage_sign', undefined, response.status) }
      const data = await json(response)
      if (typeof data.signedURL !== 'string') throw new FormError('UNAVAILABLE', 503)
      const signed = data.signedURL.startsWith('/object/sign/') ? `/storage/v1${data.signedURL}` : data.signedURL
      const url = new URL(signed, config.supabaseUrl)
      if (url.origin !== config.supabaseUrl || url.pathname !== `/storage/v1${suffix}` ||
        url.username || url.password || url.hash || !url.searchParams.get('token')) throw new FormError('UNAVAILABLE', 503)
      // Attachment disposition, without putting the applicant's original filename into the URL.
      url.searchParams.set('download', '')
      return url.href
    }),
  }
}
