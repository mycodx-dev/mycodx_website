import type { AdminConfig } from './adminConfig.ts'
import type { AdminGateway, DownloadGrant } from './adminGateway.ts'
import type { RecruitDatabase } from './supabase.ts'
import type { FormsStore } from './storage.ts'
import type { AdminApplicationDetail, AdminApplicationSummary } from '../shared/admin.ts'
import { checkOrigin } from './config.ts'
import { createAdminCookie, clearAdminCookie, readAdminSession } from './adminSession.ts'
import { EMAIL_PATTERN, FormError, readJson } from './validation.ts'
import { digest, UUID_PATTERN } from './tokens.ts'
import { takeRateSlot } from './rateLimit.ts'
import { serviceFailureLog } from './serviceDiagnostics.ts'
import { validateNews } from './newsValidation.ts'
import type { NewsPostSummary } from '../shared/news.ts'

interface Dependencies {
  config: AdminConfig
  gateway: AdminGateway
  database: RecruitDatabase
  store: FormsStore
  now?: () => number
  log?: (message: string) => void
}
const headers = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Pragma': 'no-cache', 'Vary': 'Cookie, Origin',
  'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
}
function id(value: unknown) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new FormError('INVALID_FIELDS')
  return value
}
function status(value: unknown) {
  if (value !== 'unread' && value !== 'reviewed') throw new FormError('INVALID_FIELDS')
  return value
}
function filterText(value: unknown) {
  if (value == null) return ''
  if (typeof value !== 'string' || value.length > 100 || Array.from(value).some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)) throw new FormError('INVALID_FIELDS')
  return value.trim().normalize('NFC')
}
// Explicit projections keep internal hashes, notification recipients and storage paths
// out of administrator responses, even if the DB adds columns in the future.
function summary(row: AdminApplicationSummary): AdminApplicationSummary {
  return { id: row.id, name: row.name, area: row.area, experience: row.experience,
    review_status: row.review_status, submitted_at: row.submitted_at, version: row.version }
}
function detail(data: AdminApplicationDetail): AdminApplicationDetail {
  const a = data.application
  return { application: { ...summary(a), email: a.email, phone: a.phone, education: a.education,
    message: a.message, consented_at: a.consented_at, consent_version: a.consent_version,
    expires_at: a.expires_at, reviewed_at: a.reviewed_at },
  files: data.files.map(f => ({ id: f.id, group: f.group, name: f.name, size: f.size, content_type: f.content_type })) }
}

export function createAdminHandler({ config, gateway, database, store, now = Date.now, log = console.error }: Dependencies) {
  return async (request: Request) => {
    let cookie: string | undefined
    const reply = (data: unknown, code = 200) => Response.json(data, {
      status: code, headers: { ...headers, ...(cookie ? { 'Set-Cookie': cookie } : {}) },
    })
    try {
      if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...headers, Allow: 'POST' } })
      checkOrigin(request, config)
      if (request.headers.get('x-admin-request') !== '1') throw new FormError('FORBIDDEN', 403)
      const body = await readJson(request, 200 * 1024)
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new FormError('INVALID_FIELDS')
      const input = body as Record<string, unknown>
      // Logout can always clear the browser cookie, including during a service outage.
      if (input.action === 'logout') {
        cookie = clearAdminCookie(config)
        try { await gateway.signOut(readAdminSession(request, config, now()).token) }
        catch (error) { if (!(error instanceof FormError) || error.status >= 500) log(serviceFailureLog(error)) }
        return reply({ ok: true })
      }
      if (!config.enabled) throw new FormError('UNAVAILABLE', 503)
      if (input.action === 'login') {
        if (typeof input.email !== 'string' || input.email.length > 254 || !EMAIL_PATTERN.test(input.email.trim()) ||
          typeof input.password !== 'string' || !input.password.length || input.password.length > 1024) throw new FormError('INVALID_FIELDS')
        const email = input.email.trim().toLowerCase()
        // Vercel overwrites x-real-ip. Do not trust caller-supplied forwarded-for chains.
        const ip = process.env.VERCEL ? request.headers.get('x-real-ip') || 'unknown' : 'local'
        await takeRateSlot(store, `admin-login/ip/${digest(ip, config.signingSecret)}`, 10, now())
        await takeRateSlot(store, `admin-login/email/${digest(email, config.signingSecret)}`, 10, now())
        await takeRateSlot(store, 'admin-login/global', 100, now())
        const session = await gateway.signIn(email, input.password)
        const actor = await gateway.getUser(session.token)
        if (await database.rpc('recruit_is_admin', { p_actor: actor.id }) !== true) {
          await gateway.signOut(session.token).catch(() => {})
          throw new FormError('LOGIN_FAILED', 401)
        }
        const created = createAdminCookie(session.token, session.expiresIn, config, now())
        cookie = created.cookie
        return reply({ email: actor.email, expiresAt: created.expiresAt })
      }
      const session = readAdminSession(request, config, now())
      const actor = await gateway.getUser(session.token)
      if (await database.rpc('recruit_is_admin', { p_actor: actor.id }) !== true) throw new FormError('ADMIN_FORBIDDEN', 403)
      const args = { p_actor: actor.id }
      if (typeof input.action === 'string' && input.action.startsWith('news:') && !config.newsEnabled) throw new FormError('NEWS_DISABLED', 503)
      switch (input.action) {
        case 'news:list': {
          let time: string | null = null, cursorId: string | null = null
          if (input.before != null) {
            if (typeof input.before !== 'object') throw new FormError('INVALID_FIELDS')
            const before = input.before as Record<string, unknown>
            if (typeof before.time !== 'string' || before.time.length > 40 || !Number.isFinite(Date.parse(before.time))) throw new FormError('INVALID_FIELDS')
            time = before.time; cursorId = id(before.id)
          }
          const rows = await database.rpc<NewsPostSummary[]>('news_admin_list', { ...args, p_before_time: time, p_before_id: cursorId })
          const items = rows.slice(0,20), last = items.at(-1)
          return reply({ items, nextCursor: rows.length>20 && last ? { time:last.updated_at,id:last.id } : null })
        }
        case 'news:detail': return reply(await database.rpc('news_admin_detail', { ...args, p_post_id: id(input.postId) }))
        case 'news:save': case 'news:publish': {
          if (!Number.isSafeInteger(input.version) || Number(input.version)<0 || Number(input.version)>2147483646) throw new FormError('INVALID_FIELDS')
          const values = { ...args, p_post_id: id(input.postId), p_version: input.version }
          if (input.action === 'news:save') return reply(await database.rpc('news_save', { ...values, p_draft: validateNews(input.draft) }))
          if (typeof input.publish !== 'boolean') throw new FormError('INVALID_FIELDS')
          return reply(await database.rpc('news_publish', { ...values, p_publish: input.publish }))
        }
        case 'session': return reply({ email: actor.email, expiresAt: session.expiresAt })
        case 'list': {
          const filter = input.status == null ? null : status(input.status)
          let beforeTime: string | null = null
          let beforeId: string | null = null
          if (input.before != null) {
            if (typeof input.before !== 'object' || Array.isArray(input.before)) throw new FormError('INVALID_FIELDS')
            const cursor = input.before as Record<string, unknown>
            if (typeof cursor.time !== 'string' || cursor.time.length > 40 ||
              !/^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})$/.test(cursor.time) || !Number.isFinite(Date.parse(cursor.time))) throw new FormError('INVALID_FIELDS')
            // Preserve Postgres microseconds; Date.toISOString() would lose cursor precision.
            beforeTime = cursor.time
            beforeId = id(cursor.id)
          }
          const result = await database.rpc<{ items: AdminApplicationSummary[]; options: { areas: string[]; experiences: string[] } }>('recruit_admin_search', {
            ...args, p_status: filter, p_limit: 31, p_before_time: beforeTime, p_before_id: beforeId,
            p_query: filterText(input.query), p_area: filterText(input.area) || null, p_experience: filterText(input.experience) || null,
          })
          const rows = result.items
          const items = rows.slice(0, 30).map(summary)
          const last = items.at(-1)
          return reply({ items, nextCursor: rows.length > 30 && last ? { time: last.submitted_at, id: last.id } : null,
            options: { areas: result.options.areas, experiences: result.options.experiences } })
        }
        case 'detail': return reply(detail(await database.rpc<AdminApplicationDetail>('recruit_admin_detail', {
          ...args, p_application_id: id(input.applicationId),
        })))
        case 'review': {
          if (!Number.isSafeInteger(input.version) || Number(input.version) < 0 || Number(input.version) > 2147483647) throw new FormError('INVALID_FIELDS')
          const result = await database.rpc<{ status: string; version: number }>('recruit_set_review_status', {
            ...args, p_application_id: id(input.applicationId), p_status: status(input.status), p_expected_version: input.version,
          })
          return reply({ status: result.status, version: result.version })
        }
        case 'download': {
          const fileId = id(input.fileId)
          const grant = await database.rpc<DownloadGrant>('recruit_prepare_download', { ...args, p_file_id: fileId })
          const url = await gateway.signDownload(fileId, grant)
          await database.rpc('recruit_record_download', { ...args, p_file_id: fileId, p_ttl_seconds: grant.expires_in })
          return reply({ url, expiresIn: grant.expires_in })
        }
        default: throw new FormError('INVALID_FIELDS')
      }
    } catch (error) {
      const failure = error instanceof FormError ? error : new FormError('UNAVAILABLE', 503)
      if (failure.status >= 500) log(serviceFailureLog(error))
      if (failure.status === 401 || failure.code === 'ADMIN_FORBIDDEN') cookie = clearAdminCookie(config)
      return reply({ error: failure.code }, failure.status)
    }
  }
}
