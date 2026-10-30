import { FORM_API } from '../../shared/forms.ts'
import type { FileGroup, FormKind, SubmissionInput, SubmissionSession, SubmissionState } from '../../shared/forms.ts'

export class SubmissionError extends Error {
  code: string
  receiptId?: string
  constructor(code: string, receiptId?: string) { super(code); this.code = code; this.receiptId = receiptId }
}

export interface SelectedFile { group: FileGroup; file: File }
export type SubmissionProgress = 'preparing' | 'uploading' | 'sending' | 'checking'

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

export async function submitForm(
  input: Omit<SubmissionInput, 'files'>,
  selected: SelectedFile[],
  onProgress: (progress: SubmissionProgress, percentage?: number) => void,
) {
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
