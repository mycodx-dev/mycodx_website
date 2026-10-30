import { createHash } from 'node:crypto'
import type { FormsConfig } from './config.ts'
import type { RecruitFile } from './submissions.ts'
import { FormError } from './validation.ts'
import { UUID_PATTERN } from './tokens.ts'

export const RECRUIT_BUCKET = 'recruit-files'
export const sha256 = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex')
const RPC_NAMES = new Set([
  'recruit_begin_application', 'recruit_submission_status', 'recruit_verify_file',
  'recruit_finalize_application', 'recruit_claim_notification', 'recruit_finish_notification',
])

export interface RecruitDatabase {
  rpc<T>(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<T>
  persistFile(file: RecruitFile, bytes: Uint8Array, signal?: AbortSignal): Promise<string>
}

async function boundedBytes(response: Response, limit: number) {
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
      if (!RPC_NAMES.has(name)) throw new FormError('UNAVAILABLE', 503)
      const response = await request(`/rest/v1/rpc/${name}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args),
      }, signal)
      const bytes = await boundedBytes(response, 32 * 1024)
      if (!response.ok) {
        // Only exact, known SQL errors may leave the server. Never forward row details.
        let message: unknown
        try { message = JSON.parse(bytes.toString()).message } catch { /* generic error below */ }
        if (message === 'IDEMPOTENCY_CONFLICT') throw new FormError('IDEMPOTENCY_CONFLICT', 409)
        if (message === 'APPLICATION_EXPIRED') throw new FormError('SESSION_EXPIRED', 410)
        throw new FormError('UNAVAILABLE', 503)
      }
      return (bytes.length ? JSON.parse(bytes.toString()) : null) as T
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
      const stored = await request(path, { method: 'GET' }, signal)
      if (!stored.ok) { await stored.body?.cancel(); throw new FormError('UNAVAILABLE', 503) }
      const copy = await boundedBytes(stored, file.size_bytes)
      const hash = sha256(bytes)
      if (copy.byteLength !== file.size_bytes || sha256(copy) !== hash) throw new FormError('FILE_CONFLICT', 409)
      return hash
    },
  }
}
