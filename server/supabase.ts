import { createHash } from 'node:crypto'
import type { FormsConfig } from './config.ts'
import type { RecruitFile } from './submissions.ts'
import { FormError } from './validation.ts'
import { UUID_PATTERN } from './tokens.ts'
import { ServiceOperationError, serviceOperation } from './serviceDiagnostics.ts'

export const RECRUIT_BUCKET = 'recruit-files'
export const sha256 = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex')
const RPC_NAMES = [
  'recruit_begin_application', 'recruit_submission_status', 'recruit_verify_file',
  'recruit_finalize_application', 'recruit_claim_notification', 'recruit_finish_notification',
  'recruit_is_admin', 'recruit_admin_list', 'recruit_admin_detail', 'recruit_admin_search',
  'recruit_set_review_status', 'recruit_prepare_download', 'recruit_record_download',
  'news_admin_list', 'news_admin_detail', 'news_save', 'news_publish', 'news_public_list',
] as const
const VOID_RPC_NAMES = new Set<string>(['recruit_verify_file', 'recruit_finish_notification', 'recruit_record_download'])

export interface RecruitDatabase {
  rpc<T>(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<T>
  persistFile(file: RecruitFile, bytes: Uint8Array, signal?: AbortSignal): Promise<string>
}

export async function boundedBytes(response: Response, limit: number) {
  if (!response.body) throw new FormError('UNAVAILABLE', 503)
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) { await reader.cancel(); throw new FormError('UNAVAILABLE', 503) }
      chunks.push(value)
    }
    return Buffer.concat(chunks)
  } finally { reader.releaseLock() }
}

export function createRecruitDatabase(config: FormsConfig, fetcher: typeof fetch = fetch): RecruitDatabase {
  async function request(path: string, init: RequestInit, signal?: AbortSignal) {
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl) ||
      !/^sb_secret_[A-Za-z0-9_-]+$/.test(config.supabaseSecretKey)) throw new FormError('UNAVAILABLE', 503)
    const timeout = AbortSignal.timeout(20_000)
    return fetcher(`${config.supabaseUrl}${path}`, {
      ...init, redirect: 'error', cache: 'no-store',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      // Modern secret keys are not JWTs. Never send one as a Bearer token.
      headers: { ...init.headers, apikey: config.supabaseSecretKey },
    })
  }
  return {
    async rpc<T>(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
      const operation = RPC_NAMES.find(allowed => allowed === name)
      if (!operation) throw new FormError('UNAVAILABLE', 503)
      return serviceOperation('supabase', operation, async () => {
        const response = await request(`/rest/v1/rpc/${name}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args),
        }, signal)
        // PostgREST returns 204 with a null body for RETURNS void functions.
        // Handle the HTTP result before interpreting an absent body as a failure.
        const limit = operation.startsWith('news_') ? 512 * 1024 : ['recruit_admin_list', 'recruit_admin_search'].includes(operation) ? 256 * 1024 : 32 * 1024
        const bytes = response.body ? await boundedBytes(response, limit) : Buffer.alloc(0)
        if (!response.ok) {
          // Only exact, known SQL errors may leave the server. Never forward row details.
          let message: unknown
          let providerCode: unknown
          try {
            const failure = JSON.parse(bytes.toString())
            message = failure?.message
            providerCode = failure?.code
          } catch { /* generic error below */ }
          if (message === 'IDEMPOTENCY_CONFLICT') throw new FormError('IDEMPOTENCY_CONFLICT', 409)
          if (message === 'APPLICATION_EXPIRED') throw new FormError('SESSION_EXPIRED', 410)
          if (message === 'ADMIN_REQUIRED') throw new FormError('ADMIN_FORBIDDEN', 403)
          if (message === 'APPLICATION_NOT_AVAILABLE' || message === 'FILE_NOT_AVAILABLE') throw new FormError('NOT_FOUND', 404)
          if (message === 'VERSION_CONFLICT') throw new FormError('VERSION_CONFLICT', 409)
          if (message === 'NEWS_NOT_FOUND') throw new FormError('NEWS_NOT_FOUND', 404)
          if (message === 'NEWS_SLUG_EXISTS' || message === 'NEWS_SLUG_IMMUTABLE') throw new FormError(message, 409)
          throw new ServiceOperationError('supabase', operation, undefined, response.status, providerCode)
        }
        if (!bytes.length) {
          if (VOID_RPC_NAMES.has(operation)) return null as T
          // JSON-returning RPCs must still supply their result, including JSON null.
          throw new FormError('UNAVAILABLE', 503)
        }
        return JSON.parse(bytes.toString()) as T
      })
    },
    async persistFile(file, bytes, signal) {
      // Paths originate from RPC, but validate again before attaching privileged headers.
      if (!UUID_PATTERN.test(file.id) || !UUID_PATTERN.test(file.application_id) ||
        !['pdf', 'doc', 'docx', 'zip'].includes(file.extension) ||
        file.object_path !== `v1/${file.application_id}/${file.id}.${file.extension}` ||
        bytes.byteLength !== file.size_bytes || bytes.byteLength > 10 * 1024 * 1024) {
        throw new FormError('FILE_SIZE')
      }
      const path = `/storage/v1/object/${RECRUIT_BUCKET}/${file.object_path}`
      // Immutable creation: on conflict OR a lost upload response, compare persisted
      // bytes instead of overwriting. This also makes concurrent retries safe.
      try {
        const response = await request(path, {
          method: 'POST', headers: { 'Content-Type': file.content_type, 'x-upsert': 'false', 'Cache-Control': 'max-age=0' },
          body: Buffer.from(bytes),
        }, signal)
        await response.body?.cancel()
      } catch { /* the read below is the authority for ambiguous writes */ }
      const copy = await serviceOperation('supabase', 'storage_download', async () => {
        const stored = await request(path, { method: 'GET' }, signal)
        if (!stored.ok) {
          await stored.body?.cancel()
          throw new ServiceOperationError('supabase', 'storage_download', undefined, stored.status)
        }
        return boundedBytes(stored, file.size_bytes)
      })
      const hash = sha256(bytes)
      if (copy.byteLength !== file.size_bytes || sha256(copy) !== hash) throw new FormError('FILE_CONFLICT', 409)
      return hash
    },
  }
}
