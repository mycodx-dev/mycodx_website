import { randomUUID } from 'node:crypto'
import type { SubmissionInput, SubmissionSession } from '../shared/forms.ts'
import type { FormsConfig } from './config.ts'
import type { FormsStore } from './storage.ts'
import type { OutgoingSubmission } from './mail.ts'
import type { RecruitDatabase } from './supabase.ts'
import { sha256 } from './supabase.ts'
import { submissionPath } from './submissions.ts'
import type { Manifest, RecruitFile } from './submissions.ts'
import { FormError, verifyFileBytes } from './validation.ts'
import { SESSION_TTL, UUID_PATTERN, signSession } from './tokens.ts'

// Version of the consent/storage notice shipped with this implementation.
export const RECRUIT_CONSENT_VERSION = '2026-10-30-v1'
interface Application {
  id: string
  stage: 'staging' | 'submitted'
  created_at: string
  files: RecruitFile[]
}
interface Claim { claim_token: string; recipient: string; provider: string }
interface Dependencies {
  config: FormsConfig
  store: FormsStore
  database: RecruitDatabase
  sendMail(submission: OutgoingSubmission): Promise<{ messageId: string }>
  now?: () => number
}

export function createRecruitmentService({ config, store, database, sendMail, now = Date.now }: Dependencies) {
  const status = (id: string) => database.rpc<{ stage: 'staging' | 'submitted' } | null>(
    'recruit_submission_status', { p_application_id: id },
  )
  async function readAttachments(manifest: Manifest) {
    const attachments: OutgoingSubmission['attachments'] = []
    for (const file of manifest.files) {
      const content = await store.readFile(file.pathname, file.size)
      verifyFileBytes(file.name, content)
      attachments.push({ ...file, content })
    }
    return attachments
  }

  async function notify(manifest: Manifest, attachments?: OutgoingSubmission['attachments']) {
    if (!config.enabled || !config.mailProvider) return // stays pending; DB receipt remains valid
    try {
      const claim = await database.rpc<Claim | null>('recruit_claim_notification', {
        p_application_id: manifest.id, p_provider: config.mailProvider,
      })
      if (!claim) return // another worker owns it, or already accepted/failed/uncertain
      const finish = (outcome: string, messageId: string | null, errorCode: string | null) => database.rpc(
        'recruit_finish_notification', {
          p_application_id: manifest.id, p_claim_token: claim.claim_token,
          p_outcome: outcome, p_message_id: messageId, p_error_code: errorCode,
        },
      )
      // Do not redirect a previously queued test notification after an environment change.
      if (claim.recipient !== (config.testTo || config.careersTo) || claim.provider !== config.mailProvider) {
        await finish('failed', null, 'CONFIGURATION')
        return
      }
      let files = attachments
      if (!files) {
        try { files = await readAttachments(manifest) }
        catch { await finish('failed', null, 'FILE_UNAVAILABLE'); return }
      }
      let receipt: { messageId: string }
      try { receipt = await sendMail({ ...manifest, attachments: files }) }
      catch { await finish('uncertain', null, 'NETWORK_UNCERTAIN'); return }
      // Retrying the receipt write is safe; retrying provider delivery is not.
      try { await finish('accepted', receipt.messageId, null) }
      catch { await finish('accepted', receipt.messageId, null) }
    } catch {
      console.error(JSON.stringify({ event: 'recruit_notification_needs_review', applicationId: manifest.id }))
    }
  }

  return {
    async start(input: SubmissionInput, key: unknown): Promise<SubmissionSession> {
      if (typeof key !== 'string' || !UUID_PATTERN.test(key)) throw new FormError('INVALID_FIELDS')
      const app = await database.rpc<Application>('recruit_begin_application', {
        p_id: randomUUID(), p_idempotency_key_hash: sha256(key), p_fields: input.fields,
        p_files: input.files, p_language: input.language, p_consent: input.consent,
        p_consent_version: RECRUIT_CONSENT_VERSION,
      })
      const createdAt = Date.parse(app.created_at)
      if (!UUID_PATTERN.test(app.id) || !Number.isSafeInteger(createdAt) || createdAt > now() ||
        !['staging', 'submitted'].includes(app.stage)) throw new FormError('UNAVAILABLE', 503)
      const expiresAt = createdAt + SESSION_TTL
      const base = { id: app.id, expiresAt, token: signSession(app.id, createdAt, config.signingSecret) }
      if (app.stage === 'submitted') return { ...base, files: [], status: 'submitted' }
      if (expiresAt <= now()) throw new FormError('SESSION_EXPIRED', 410)
      const path = submissionPath(app.id, createdAt)
      if (!Array.isArray(app.files) || app.files.length !== input.files.length || app.files.some((file, index) =>
        file.application_id !== app.id || !UUID_PATTERN.test(file.id) || file.slot !== index ||
        file.original_name !== input.files[index].name || file.size_bytes !== input.files[index].size ||
        file.file_group !== input.files[index].group)) throw new FormError('UNAVAILABLE', 503)
      const files = app.files.map(file => ({
        group: file.file_group, name: file.original_name, size: file.size_bytes,
        contentType: file.content_type, pathname: `${path}files/${file.id}.${file.extension}`,
      }))
      const manifest: Manifest = { ...input, id: app.id, createdAt, files, recruitFiles: app.files }
      // DB-generated IDs/timestamps keep paths stable if start/manifest/ticket responses are lost.
      if (!await store.createJson(`${path}manifest.json`, manifest)) {
        const previous = await store.readJson<Manifest>(`${path}manifest.json`)
        if (!previous?.recruitFiles || JSON.stringify(previous.files) !== JSON.stringify(files)) {
          throw new FormError('UNAVAILABLE', 503)
        }
      }
      const tickets = []
      for (const file of files) {
        let uploaded = false
        try {
          const bytes = await store.readFile(file.pathname, file.size)
          verifyFileBytes(file.name, bytes)
          uploaded = true
        } catch (error) {
          if (!(error instanceof FormError) || error.code !== 'UPLOAD_INCOMPLETE') throw error
        }
        tickets.push({ ...file, uploaded, uploadToken: uploaded ? '' : await store.uploadToken(file, expiresAt) })
      }
      return { ...base, files: tickets, status: 'ready' }
    },
    async handle(action: 'status' | 'submit', manifest: Manifest) {
      if (!manifest.recruitFiles) throw new FormError('UNAVAILABLE', 503) // legacy mail-only receipt
      const current = await status(manifest.id)
      if (!current) throw new FormError('SESSION_EXPIRED', 410)
      if (action === 'status') return { id: manifest.id, status: current.stage === 'submitted' ? 'submitted' : 'ready' }
      if (current.stage === 'submitted') {
        await notify(manifest)
        return { id: manifest.id, status: 'submitted' }
      }
      if (now() - manifest.createdAt >= SESSION_TTL) throw new FormError('SESSION_EXPIRED', 410)
      let attachments: OutgoingSubmission['attachments'] | undefined
      try {
        // Original bytes bypass Vercel's HTTP request size limit through direct Blob uploads.
        // A bounded persistence budget leaves time for an optional notification in this function.
        const signal = AbortSignal.timeout(80_000)
        attachments = await readAttachments(manifest)
        for (const [index, file] of manifest.recruitFiles.entries()) {
          const hash = await database.persistFile(file, attachments[index].content, signal)
          await database.rpc('recruit_verify_file', {
            p_application_id: manifest.id, p_file_id: file.id, p_sha256: hash,
          }, signal)
        }
        const result = await database.rpc<{ stage: string }>('recruit_finalize_application', {
          p_application_id: manifest.id, p_recipient: config.testTo || config.careersTo,
          p_provider: config.mailProvider ?? null,
        }, signal)
        if (result?.stage !== 'submitted') throw new FormError('UNAVAILABLE', 503)
      } catch (error) {
        // Another submit may have committed, or the transaction response may have been lost.
        // Never undo saved files or a committed receipt during a concurrent retry.
        const confirmed = await status(manifest.id).catch(() => null)
        if (confirmed?.stage !== 'submitted') throw error
      }
      await notify(manifest, attachments)
      return { id: manifest.id, status: 'submitted' }
    },
  }
}

export type RecruitmentService = ReturnType<typeof createRecruitmentService>
