import { FORM_API, MAX_FILES, MAX_TOTAL_FILE_SIZE } from '../../shared/forms.ts'
import type { FileGroup, FormKind, SubmissionInput, SubmissionSession, SubmissionState } from '../../shared/forms.ts'

export class SubmissionError extends Error {
  code: string
  receiptId?: string
  constructor(code: string, receiptId?: string) { super(code); this.code = code; this.receiptId = receiptId }
}

export interface SelectedFile { group: FileGroup; file: File }
export type SubmissionProgress = 'preparing' | 'uploading' | 'sending' | 'saving' | 'checking'

async function api<T>(body: unknown): Promise<T> {
  const response = await fetch(FORM_API, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(150_000),
  })
  const result = await response.json().catch(() => { throw new SubmissionError('UNAVAILABLE') })
  if (!response.ok) throw new SubmissionError(result.error ?? 'UNAVAILABLE')
  return result as T
}

interface PendingSubmission { id: string; token: string }
const memory = new Map<FormKind, PendingSubmission>()
const storageKey = (kind: FormKind) => `mycodx-pending-${kind}`

function remember(kind: FormKind, pending: PendingSubmission) {
  memory.set(kind, pending)
  try { sessionStorage.setItem(storageKey(kind), JSON.stringify(pending)) } catch { /* storage may be disabled */ }
}

function pendingFor(kind: FormKind): PendingSubmission | undefined {
  if (memory.has(kind)) return memory.get(kind)
  try {
    const item = JSON.parse(sessionStorage.getItem(storageKey(kind)) ?? 'null')
    if (item && typeof item.id === 'string' && typeof item.token === 'string') return item
  } catch { /* unavailable or stale browser storage */ }
}

function forget(kind: FormKind) {
  memory.delete(kind)
  try { sessionStorage.removeItem(storageKey(kind)) } catch { /* storage may be disabled */ }
}

async function confirmPending(kind: FormKind, pending: PendingSubmission) {
  const result = await api<{ id: string; status: SubmissionState }>({ action: 'status', token: pending.token })
  if (result.status === 'sent') { forget(kind); return result.id }
  // Even if the first request is still starting, never race it with a new send.
  throw new SubmissionError('DELIVERY_UNCERTAIN', pending.id)
}

interface RecruitPending {
  key: string
  fingerprint: string
  phase: 'upload' | 'submit' | 'done'
  session?: PendingSubmission
}
const recruitStorageKey = 'mycodx-recruit-operation-v1'
let recruitMemory: RecruitPending | undefined
let recruitInFlight: Promise<string> | undefined

function recruitPending(): RecruitPending | undefined {
  if (recruitMemory) return recruitMemory
  try {
    const value = JSON.parse(sessionStorage.getItem(recruitStorageKey) ?? 'null')
    if (value && typeof value.key === 'string' && typeof value.fingerprint === 'string' &&
      ['upload', 'submit', 'done'].includes(value.phase) && (!value.session ||
        (typeof value.session.id === 'string' && typeof value.session.token === 'string'))) return value
  } catch { /* private storage can be unavailable */ }
}

function rememberRecruit(value: RecruitPending) {
  recruitMemory = value
  // No fields, filenames, file bytes, upload credentials, or Supabase keys are stored.
  try { sessionStorage.setItem(recruitStorageKey, JSON.stringify(value)) } catch { /* memory fallback */ }
}

async function submitRecruit(
  input: Omit<SubmissionInput, 'files'>, selected: SelectedFile[],
  onProgress: (progress: SubmissionProgress, percentage?: number) => void,
) {
  // A pre-migration mail-only token must never silently become a second DB submission.
  if (pendingFor('careers')) throw new SubmissionError('RECRUIT_UNCERTAIN')
  if (selected.length > MAX_FILES) throw new SubmissionError('FILE_COUNT')
  const total = selected.reduce((sum, { file }) => sum + file.size, 0)
  if (total > MAX_TOTAL_FILE_SIZE) throw new SubmissionError('FILE_SIZE')
  onProgress('preparing')
  const old = recruitPending()
  // A confirmed receipt can be recovered even if a reload lost the selected files
  // or the user edited a field while the previous request was still in flight.
  if (old?.phase === 'submit' && old.session) {
    onProgress('checking')
    const current = await api<{ status: SubmissionState }>({ action: 'status', token: old.session.token }).catch(() => null)
    if (current?.status === 'submitted') {
      rememberRecruit({ ...old, phase: 'done' })
      return old.session.id
    }
    if (current?.status !== 'ready') throw new SubmissionError('RECRUIT_UNCERTAIN')
  }
  const key = old?.key ?? crypto.randomUUID()
  const hex = async (value: ArrayBuffer) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', value)),
    byte => byte.toString(16).padStart(2, '0')).join('')
  const hashes: string[] = []
  for (const { file } of selected) hashes.push(await hex(await file.arrayBuffer()))
  const fields = Object.fromEntries(Object.entries(input.fields).sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => [name, value.trim().normalize('NFC')]))
  const fingerprintFor = (salt: string) => hex(new TextEncoder().encode(JSON.stringify({
    salt, fields, language: input.language, consent: input.consent,
    files: selected.map(({ group, file }, index) => ({ group, name: file.name, size: file.size, hash: hashes[index] })),
  })).buffer)
  const fingerprint = await fingerprintFor(key)
  let operation: RecruitPending = old ?? { key, fingerprint, phase: 'upload' }
  if (old && old.fingerprint !== fingerprint) {
    // Once commit was requested, editing fields cannot bypass the same operation's status.
    if (old.phase === 'submit') throw new SubmissionError('RECRUIT_UNCERTAIN')
    // A changed draft or a new application after confirmed success gets a new key.
    operation = { key: crypto.randomUUID(), fingerprint: '', phase: 'upload' }
    operation.fingerprint = await fingerprintFor(operation.key)
  }
  rememberRecruit(operation) // persist the key BEFORE the first start request
  if (operation.session && operation.phase !== 'submit') {
    onProgress('checking')
    let current: { status: SubmissionState }
    try { current = await api({ action: 'status', token: operation.session.token }) }
    catch { throw new SubmissionError('RECRUIT_UNCERTAIN') }
    if (current.status === 'submitted') {
      rememberRecruit({ ...operation, phase: 'done' })
      return operation.session.id
    }
    if (current.status !== 'ready') throw new SubmissionError('RECRUIT_UNCERTAIN')
  }
  // A submit response may be lost while the function is still running. Replaying
  // the SAME signed token is safe: DB finalization and notification claim are atomic.
  if (operation.phase !== 'submit' || !operation.session) {
    const session = await api<SubmissionSession>({ action: 'start', idempotencyKey: operation.key,
      submission: { ...input, files: selected.map(({ group, file }) => ({ group, name: file.name, size: file.size })) },
    })
    operation = { ...operation, session: { id: session.id, token: session.token } }
    rememberRecruit(operation)
    if (session.status === 'submitted') {
      rememberRecruit({ ...operation, phase: 'done' })
      return session.id
    }
    let completed = 0
    for (const [index, { file }] of selected.entries()) {
      const ticket = session.files[index]
      if (!ticket) throw new SubmissionError('UPLOAD_FAILED')
      onProgress('uploading', Math.round(100 * completed / total))
      if (!ticket.uploaded) {
        const { put } = await import('@vercel/blob/client')
        await put(ticket.pathname, file, {
          token: ticket.uploadToken, access: 'private', contentType: ticket.contentType,
          abortSignal: AbortSignal.timeout(300_000),
          onUploadProgress: ({ loaded }) => onProgress('uploading', Math.round(100 * (completed + loaded) / total)),
        }).catch(() => { throw new SubmissionError('UPLOAD_FAILED') })
      }
      completed += file.size
    }
  }
  const session = operation.session!
  operation = { ...operation, phase: 'submit' }
  rememberRecruit(operation)
  onProgress('saving')
  try {
    const result = await api<{ status: SubmissionState }>({ action: 'submit', token: session.token })
    if (result.status !== 'submitted') throw new SubmissionError('RECRUIT_UNCERTAIN')
  } catch (error) {
    onProgress('checking')
    const current = await api<{ status: SubmissionState }>({ action: 'status', token: session.token }).catch(() => null)
    if (current?.status !== 'submitted') {
      if (current?.status === 'ready' && error instanceof SubmissionError &&
        ['UPLOAD_INCOMPLETE', 'FILE_SIZE', 'FILE_TYPE', 'FILE_CONFLICT'].includes(error.code)) {
        rememberRecruit({ ...operation, phase: 'upload' })
        throw error
      }
      throw new SubmissionError('RECRUIT_UNCERTAIN')
    }
  }
  rememberRecruit({ ...operation, phase: 'done' })
  return session.id
}

export async function submitForm(
  input: Omit<SubmissionInput, 'files'>,
  selected: SelectedFile[],
  onProgress: (progress: SubmissionProgress, percentage?: number) => void,
) {
  if (input.kind === 'careers') {
    if (recruitInFlight) return recruitInFlight
    recruitInFlight = submitRecruit(input, selected, onProgress)
    try { return await recruitInFlight } finally { recruitInFlight = undefined }
  }
  const pending = pendingFor(input.kind)
  if (pending) {
    onProgress('checking')
    try { return await confirmPending(input.kind, pending) }
    catch { throw new SubmissionError('DELIVERY_UNCERTAIN', pending.id) }
  }
  onProgress('preparing')
  const session = await api<SubmissionSession>({
    action: 'start', submission: { ...input, files: selected.map(({ group, file }) => ({ group, name: file.name, size: file.size })) },
  })
  const total = selected.reduce((sum, item) => sum + item.file.size, 0)
  let completed = 0
  for (const [index, { file }] of selected.entries()) {
    const ticket = session.files[index]
    onProgress('uploading', Math.round(100 * completed / total))
    const { put } = await import('@vercel/blob/client')
    await put(ticket.pathname, file, {
      token: ticket.uploadToken, access: 'private', contentType: ticket.contentType,
      abortSignal: AbortSignal.timeout(300_000),
      onUploadProgress: ({ loaded }) => onProgress('uploading', Math.round(100 * (completed + loaded) / total)),
    }).catch(() => { throw new SubmissionError('UPLOAD_FAILED') })
    completed += file.size
  }
  onProgress('sending')
  // Keep only the opaque receipt token (no candidate data or upload credentials).
  // Persist BEFORE dispatch so a reload or timeout cannot trigger a duplicate email.
  remember(input.kind, { id: session.id, token: session.token })
  try {
    const result = await api<{ id: string; status: SubmissionState }>({ action: 'submit', token: session.token })
    if (result.status !== 'sent') throw new SubmissionError('DELIVERY_UNCERTAIN')
    forget(input.kind)
    return result.id
  } catch (error) {
    if (error instanceof SubmissionError && ['UPLOAD_INCOMPLETE', 'FILE_SIZE', 'FILE_TYPE', 'SESSION_EXPIRED', 'INVALID_SESSION', 'FORBIDDEN'].includes(error.code)) {
      forget(input.kind) // server rejected BEFORE dispatch
      throw error
    }
    onProgress('checking')
    try { return await confirmPending(input.kind, session) }
    catch { throw new SubmissionError('DELIVERY_UNCERTAIN', session.id) }
  }
}
