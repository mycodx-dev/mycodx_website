import { randomUUID } from 'node:crypto'
import { FILE_TYPES, MAX_FILES, MAX_TOTAL_FILE_SIZE, fileExtension } from '../shared/forms.ts'
import type { SubmissionInput, SubmissionSession, SubmissionState, UploadTicket } from '../shared/forms.ts'
import { checkOrigin } from './config.ts'
import type { FormsConfig } from './config.ts'
import { FormError, readJson, validateSubmission, verifyFileBytes } from './validation.ts'
import { digest, SESSION_TTL, signSession, verifySession } from './tokens.ts'
import { STORAGE_PREFIX } from './storage.ts'
import type { FormsStore } from './storage.ts'
import type { OutgoingSubmission } from './mail.ts'

interface Manifest extends SubmissionInput {
  id: string
  createdAt: number
  files: Omit<UploadTicket, 'uploadToken'>[]
}

interface Dependencies {
  config: FormsConfig
  store: FormsStore
  sendMail(submission: OutgoingSubmission): Promise<{ messageId: string }>
  now?: () => number
  uuid?: () => string
}

export function submissionPath(id: string, issuedAt: number) {
  return `${STORAGE_PREFIX}submissions/${new Date(issuedAt).toISOString().slice(0, 10)}/${id}/`
}

async function takeRateSlot(store: FormsStore, scope: string, limit: number, now: number) {
  const hour = Math.floor(now / 3_600_000)
  for (let slot = 0; slot < limit; slot++) {
    if (await store.createJson(`${STORAGE_PREFIX}rate/${hour}/${scope}/${slot}.json`, { createdAt: now })) return
  }
  throw new FormError('RATE_LIMITED', 429)
}

function response(data: unknown, status = 200) {
  return Response.json(data, {
    status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' },
  })
}

export function createFormsHandler(deps: Dependencies) {
  const { store, config } = deps
  const now = deps.now ?? Date.now
  const uuid = deps.uuid ?? randomUUID

  async function state(path: string): Promise<SubmissionState> {
    if (await store.readJson(`${path}sent.json`)) return 'sent'
    if (await store.readJson(`${path}uncertain.json`)) return 'uncertain'
    const dispatch = await store.readJson<{ startedAt: number }>(`${path}dispatch.json`)
    if (dispatch) return now() - dispatch.startedAt < 180_000 ? 'sending' : 'uncertain'
    return 'ready'
  }

  return async (request: Request): Promise<Response> => {
    try {
      if (request.method === 'GET') return response({ enabled: config.enabled, maxTotalBytes: MAX_TOTAL_FILE_SIZE, maxFiles: MAX_FILES })
      if (request.method !== 'POST') return response({ error: 'METHOD_NOT_ALLOWED' }, 405)
      checkOrigin(request, config)
      if (!config.enabled) throw new FormError('UNAVAILABLE', 503)
      const body = await readJson(request) as Record<string, unknown>
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new FormError('INVALID_FIELDS')

      if (body.action === 'start') {
        const input = validateSubmission(body.submission, now())
        // On Vercel these proxy headers are supplied by the platform. On the local dev
        // server all callers share one bucket; never accept a caller-selected rate key.
        const ip = process.env.VERCEL ? request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for') || 'unknown' : 'local'
        await takeRateSlot(store, digest(ip, config.signingSecret), 5, now())
        await takeRateSlot(store, 'global', 100, now())
        const id = uuid()
        const createdAt = now()
        const expiresAt = createdAt + SESSION_TTL
        const path = submissionPath(id, createdAt)
        const files = input.files.map(file => ({
          ...file, pathname: `${path}files/${uuid()}.${fileExtension(file.name)}`,
          contentType: FILE_TYPES[fileExtension(file.name)],
        }))
        const manifest: Manifest = { ...input, files, id, createdAt }
        if (!await store.createJson(`${path}manifest.json`, manifest)) throw new FormError('UNAVAILABLE', 503)
        const tickets = await Promise.all(files.map(async file => ({
          ...file, uploadToken: await store.uploadToken(file, expiresAt),
        })))
        const session: SubmissionSession = { id, expiresAt, token: signSession(id, createdAt, config.signingSecret), files: tickets }
        return response(session, 201)
      }

      if (body.action !== 'submit' && body.action !== 'status') throw new FormError('INVALID_FIELDS')
      const session = verifySession(body.token, config.signingSecret, now(), body.action === 'status')
      const path = submissionPath(session.id, session.issuedAt)
      const manifest = await store.readJson<Manifest>(`${path}manifest.json`)
      if (!manifest) throw new FormError('SESSION_EXPIRED', 410)
      const current = await state(path)
      if (body.action === 'status') return response({ id: session.id, status: current })
      if (current !== 'ready') return response({ id: session.id, status: current }, current === 'sent' ? 200 : 202)

      // Read only server-issued paths from the immutable manifest, never client URLs.
      // Buffering is bounded to 10 MiB in total and permits validation before sending to Resend.
      const attachments: OutgoingSubmission['attachments'] = []
      for (const file of manifest.files) {
        const content = await store.readFile(file.pathname, file.size)
        verifyFileBytes(file.name, content)
        attachments.push({ ...file, content })
      }
      // Immutable create-if-absent lock survives concurrent requests, cold starts and
      // response loss. Never automatically retry an ambiguous provider transaction.
      if (!await store.createJson(`${path}dispatch.json`, { startedAt: now() })) {
        return response({ id: session.id, status: await state(path) }, 202)
      }
      try {
        const receipt = await deps.sendMail({ ...manifest, attachments })
        await store.createJson(`${path}sent.json`, { ...receipt, acceptedAt: now() })
        return response({ id: session.id, status: 'sent' })
      } catch {
        await store.createJson(`${path}uncertain.json`, { occurredAt: now() }).catch(() => undefined)
        console.error(JSON.stringify({ event: 'mail_delivery_uncertain', submissionId: session.id }))
        return response({ id: session.id, status: 'uncertain' }, 202)
      }
    } catch (error) {
      if (error instanceof FormError) return response({ error: error.code }, error.status)
      // Do not log API keys, candidate details, files, tokens or vendor errors.
      console.error(JSON.stringify({ event: 'forms_service_error' }))
      return response({ error: 'UNAVAILABLE' }, 503)
    }
  }
}
