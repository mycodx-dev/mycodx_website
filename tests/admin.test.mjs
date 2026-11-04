import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { getAdminConfig } from '../server/adminConfig.ts'
import { createAdminHandler } from '../server/admin.ts'
import { createAdminCookie, readAdminSession, ADMIN_SESSION_MS } from '../server/adminSession.ts'
import { createAdminGateway } from '../server/adminGateway.ts'
import { createRecruitDatabase } from '../server/supabase.ts'
import { FormError } from '../server/validation.ts'

const NOW = Date.UTC(2026, 10, 4, 8)
const ORIGIN = 'https://example.test'
const TOKEN = 'header.payload.signature'
const USER = randomUUID(), APP = randomUUID(), FILE = randomUUID()
const env = { SUPABASE_URL: 'https://test-project.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', FORM_SIGNING_SECRET: 'test-only-secret-longer-than-thirty-two-characters',
  BLOB_READ_WRITE_TOKEN: 'test-only-blob-token', FORM_ALLOWED_ORIGINS: ORIGIN, NODE_ENV: 'production' }
const config = getAdminConfig(env)
const row = { id: APP, name: '가상 지원자', area: '연구', experience: '신입', review_status: 'unread',
  submitted_at: '2026-11-04T00:00:00.123456+00:00', version: 0 }
const application = { ...row, email: 'applicant@example.test', phone: '010-0000-0000', education: '학사', message: '테스트',
  consented_at: row.submitted_at, consent_version: 'v1', expires_at: '2027-11-04T00:00:00Z', reviewed_at: null,
  payload_hash: 'PRIVATE_HASH', idempotency_key_hash: 'PRIVATE_IDEMPOTENCY', reviewed_by: USER }
const file = { id: FILE, group: 'application', name: 'test.pdf', size: 20, content_type: 'application/pdf', object_path: 'PRIVATE_PATH' }
const grant = { bucket: 'recruit-files', path: `v1/${APP}/${FILE}.pdf`, filename: 'test.pdf', expires_in: 60 }

function fixture(options = {}) {
  const calls = [], logs = [], rate = new Map()
  let active = options.active ?? true
  const gateway = {
    async signIn(email, password) { calls.push(['login', email]); if (options.invalidLogin) throw new FormError('LOGIN_FAILED', 401); assert.equal(password, 'password-test-only'); return { token: TOKEN, expiresIn: 3600 } },
    async getUser(token) { assert.equal(token, TOKEN); calls.push(['user']); return { id: USER, email: 'admin@example.test' } },
    async signOut() { calls.push(['logout']) },
    async signDownload() { calls.push(['sign']); return 'https://test-project.supabase.co/storage/signed?token=TEST_ONLY' },
  }
  const database = { async rpc(name, args) {
    calls.push([name, args]); assert.equal(args.p_actor, USER)
    switch (name) {
      case 'recruit_is_admin': return active
      case 'recruit_admin_search': return { items: options.rows ?? [row], options: { areas: ['연구'], experiences: ['신입'] } }
      case 'recruit_admin_detail': return { application, files: [file] }
      case 'recruit_set_review_status':
        if (args.p_expected_version !== 0) throw new FormError('VERSION_CONFLICT', 409)
        return { status: args.p_status, version: 1 }
      case 'recruit_prepare_download': return grant
      case 'recruit_record_download': if (options.auditFails) throw new Error('PRIVATE_CANDIDATE_SECRET'); return null
      default: throw new Error('Unexpected RPC')
    }
  } }
  const store = { async createJson(path, value) { if (rate.has(path)) return false; rate.set(path, value); return true } }
  const handler = createAdminHandler({ config: options.config ?? config, database, gateway, store, now: () => NOW, log: value => logs.push(value) })
  const cookie = createAdminCookie(TOKEN, 3600, config, NOW).cookie.split(';')[0]
  const post = (input, headers = {}, method = 'POST') => handler(new Request(`${ORIGIN}/api/admin`, {
    method, headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'X-Admin-Request': '1', Cookie: cookie, ...headers },
    ...(method === 'POST' ? { body: JSON.stringify(input) } : {}),
  }))
  return { post, calls, logs, rate, revoke: () => { active = false } }
}

test('admin configuration is independent of email provider and needs server-only prerequisites', () => {
  assert.equal(config.enabled, true)
  for (const key of ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'FORM_SIGNING_SECRET', 'BLOB_READ_WRITE_TOKEN', 'FORM_ALLOWED_ORIGINS']) {
    assert.equal(getAdminConfig({ ...env, [key]: '' }).enabled, false, key)
  }
  assert.equal(getAdminConfig({ ...env, SUPABASE_URL: 'https://attacker.test' }).enabled, false)
})

test('admin session is signed, HttpOnly, Secure, Strict, host-only, expires within one hour', () => {
  const session = createAdminCookie(TOKEN, 7200, config, NOW)
  assert.equal(session.expiresAt, NOW + ADMIN_SESSION_MS)
  for (const property of ['__Secure-mycodx-admin=', 'HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/api/admin', 'Max-Age=3600']) assert.ok(session.cookie.includes(property))
  assert.ok(!session.cookie.includes('Domain='))
  const cookie = session.cookie.split(';')[0]
  const request = value => new Request(ORIGIN, { headers: { cookie: value } })
  assert.equal(readAdminSession(request(cookie), config, NOW).token, TOKEN)
  for (const value of ['', cookie.replace('payload', 'forged'), `${cookie}; ${cookie}`, cookie + '~extra', cookie + '~', cookie.replace(/.$/, 'é')]) {
    assert.throws(() => readAdminSession(request(value), config, NOW), { code: 'AUTH_REQUIRED' })
  }
  assert.throws(() => readAdminSession(request(cookie), config, NOW + ADMIN_SESSION_MS), { code: 'AUTH_REQUIRED' })
})

test('CSRF, non-POST, missing session and inactive administrator fail before private RPCs', async () => {
  const f = fixture()
  for (const [headers, status] of [[{ Origin: 'https://attacker.test' }, 403], [{ Origin: '' }, 403],
    [{ 'X-Admin-Request': '' }, 403], [{ 'Sec-Fetch-Site': 'cross-site' }, 403], [{ Cookie: '' }, 401]]) {
    assert.equal((await f.post({ action: 'list' }, headers)).status, status)
  }
  assert.equal((await f.post({}, {}, 'GET')).status, 405)
  assert.equal(f.calls.length, 0)
  f.revoke()
  const denied = await f.post({ action: 'detail', applicationId: APP })
  assert.equal(denied.status, 403)
  assert.match(denied.headers.get('set-cookie'), /Max-Age=0/)
  assert.deepEqual(f.calls.map(c => c[0]), ['user', 'recruit_is_admin'])
})

test('login returns no access/refresh token and rejects valid but non-approved accounts', async () => {
  const f = fixture()
  const result = await f.post({ action: 'login', email: 'admin@example.test', password: 'password-test-only' }, { Cookie: '' })
  assert.equal(result.status, 200)
  assert.deepEqual(await result.json(), { email: 'admin@example.test', expiresAt: NOW + ADMIN_SESSION_MS })
  assert.match(result.headers.get('set-cookie'), /HttpOnly/)
  assert.match(result.headers.get('cache-control'), /no-store/)
  assert.equal(result.headers.get('access-control-allow-origin'), null)
  assert.ok([...f.rate.keys()].every(key => !key.includes('admin@example.test')))
  const unapproved = fixture({ active: false })
  const rejected = await unapproved.post({ action: 'login', email: 'admin@example.test', password: 'password-test-only' }, { Cookie: '' })
  assert.equal(rejected.status, 401)
  assert.deepEqual(await rejected.json(), { error: 'LOGIN_FAILED' })
  assert.match(rejected.headers.get('set-cookie'), /Max-Age=0/)
})

test('login rate limiting uses durable shared slots and does not call Auth after limit', async () => {
  const f = fixture({ invalidLogin: true })
  for (let i = 0; i < 10; i++) assert.equal((await f.post({ action: 'login', email: 'admin@example.test', password: 'password-test-only' })).status, 401)
  assert.equal((await f.post({ action: 'login', email: 'admin@example.test', password: 'password-test-only' })).status, 429)
  assert.equal(f.calls.filter(c => c[0] === 'login').length, 10)
})

test('list uses verified actor, bounded pagination, exact microsecond cursor and explicit fields', async () => {
  const f = fixture({ rows: Array.from({ length: 31 }, (_, i) => ({ ...row, id: i === 29 ? APP : randomUUID(), payload_hash: 'PRIVATE_HASH' })) })
  const before = { time: row.submitted_at, id: APP }
  const response = await f.post({ action: 'list', status: 'unread', before, p_actor: randomUUID(), limit: 999999 })
  const data = await response.json()
  assert.equal(response.status, 200)
  assert.equal(data.items.length, 30)
  assert.deepEqual(data.nextCursor, before)
  assert.ok(!JSON.stringify(data).includes('PRIVATE_HASH'))
  assert.deepEqual(f.calls.at(-1), ['recruit_admin_search', { p_actor: USER, p_status: 'unread', p_limit: 31, p_before_time: before.time, p_before_id: APP, p_query: '', p_area: null, p_experience: null }])
  assert.equal((await f.post({ action: 'list', before: { time: 'bad', id: APP } })).status, 400)
})

test('detail audits via existing RPC and excludes internal fields; version zero can be reviewed', async () => {
  const f = fixture()
  const response = await f.post({ action: 'detail', applicationId: APP })
  const data = await response.json()
  assert.equal(data.application.name, application.name)
  assert.ok(!JSON.stringify(data).includes('PRIVATE_'))
  assert.equal(f.calls.at(-1)[0], 'recruit_admin_detail')
  const changed = await f.post({ action: 'review', applicationId: APP, version: 0, status: 'reviewed' })
  assert.deepEqual(await changed.json(), { status: 'reviewed', version: 1 })
  const conflict = await f.post({ action: 'review', applicationId: APP, version: 9, status: 'unread' })
  assert.equal(conflict.status, 409)
  assert.deepEqual(await conflict.json(), { error: 'VERSION_CONFLICT' })
  assert.equal((await f.post({ action: 'review', applicationId: APP, version: -1, status: 'reviewed' })).status, 400)
})

test('download URL is issued only after signing and committed audit; failures expose neither URL nor PII', async () => {
  const f = fixture()
  const response = await f.post({ action: 'download', fileId: FILE })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).expiresIn, 60)
  assert.deepEqual(f.calls.slice(-3).map(c => c[0]), ['recruit_prepare_download', 'sign', 'recruit_record_download'])
  const failing = fixture({ auditFails: true })
  const failure = await failing.post({ action: 'download', fileId: FILE })
  assert.equal(failure.status, 503)
  assert.deepEqual(await failure.json(), { error: 'UNAVAILABLE' })
  assert.ok(!JSON.stringify(failing.logs).includes('PRIVATE_'))
  f.revoke()
  assert.equal((await f.post({ action: 'download', fileId: FILE })).status, 403)
})

test('logout clears cookie even with disabled service or expired cookie', async () => {
  const f = fixture({ config: { ...config, enabled: false } })
  const response = await f.post({ action: 'logout' }, { Cookie: '' })
  assert.equal(response.status, 200)
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/)
})

test('Auth adapter sends publishable key and user bearer only, never server secret or refresh token to browser', async () => {
  const calls = []
  const gateway = createAdminGateway(config, async (url, init) => {
    calls.push([url, init])
    if (url.includes('/token?')) return Response.json({ access_token: TOKEN, expires_in: 3600, refresh_token: 'REFRESH_PRIVATE' })
    if (url.endsWith('/user')) return Response.json({ id: USER, email: 'admin@example.test', is_anonymous: false })
    return new Response(null, { status: 204 })
  })
  assert.deepEqual(await gateway.signIn('admin@example.test', 'password-test-only'), { token: TOKEN, expiresIn: 3600 })
  assert.equal((await gateway.getUser(TOKEN)).id, USER)
  await gateway.signOut(TOKEN)
  for (const [, init] of calls) {
    assert.equal(init.headers.apikey, config.publishableKey)
    assert.equal(init.redirect, 'error')
    assert.equal(init.cache, 'no-store')
    assert.ok(!JSON.stringify(init).includes(config.supabaseSecretKey))
  }
  assert.equal(calls[1][1].headers.Authorization, `Bearer ${TOKEN}`)
  assert.match(calls[2][0], /scope=local/)
})

test('Storage adapter bounds TTL/path and validates same-project signed URL before returning attachment', async () => {
  let calls = 0
  const suffix = `/object/sign/recruit-files/${grant.path}`
  const gateway = createAdminGateway(config, async (url, init) => {
    calls++
    assert.equal(url, `${config.supabaseUrl}/storage/v1${suffix}`)
    assert.equal(init.headers.apikey, config.supabaseSecretKey)
    assert.equal(init.headers.Authorization, undefined)
    assert.deepEqual(JSON.parse(init.body), { expiresIn: 60 })
    return Response.json({ signedURL: `${suffix}?token=test-only` })
  })
  const url = new URL(await gateway.signDownload(FILE, grant))
  assert.equal(url.origin, config.supabaseUrl)
  assert.ok(url.searchParams.has('download'))
  for (const invalid of [{ ...grant, expires_in: 61 }, { ...grant, expires_in: 0 }, { ...grant, path: '../private' }, { ...grant, bucket: 'public' }]) {
    await assert.rejects(gateway.signDownload(FILE, invalid), { code: 'UNAVAILABLE' })
  }
  assert.equal(calls, 1)
  const malicious = createAdminGateway(config, async () => Response.json({ signedURL: `https://attacker.test/storage/v1${suffix}?token=x` }))
  await assert.rejects(malicious.signDownload(FILE, grant), { code: 'UNAVAILABLE' })
})

test('real RPC adapter supports void download audit and safe administrator error mappings', async () => {
  const database = createRecruitDatabase(config, async () => new Response(null, { status: 204 }))
  assert.equal(await database.rpc('recruit_record_download', { p_actor: USER, p_file_id: FILE, p_ttl_seconds: 60 }), null)
  for (const [message, code, status] of [['ADMIN_REQUIRED', 'ADMIN_FORBIDDEN', 403], ['APPLICATION_NOT_AVAILABLE', 'NOT_FOUND', 404], ['VERSION_CONFLICT', 'VERSION_CONFLICT', 409]]) {
    const rejected = createRecruitDatabase(config, async () => Response.json({ message, details: 'PRIVATE_PII' }, { status: 400 }))
    await assert.rejects(rejected.rpc('recruit_admin_detail', {}), { code, status })
  }
})

 test('search forwards combined filters as bound RPC arguments, rejects oversized and control text', async () => {
  const f = fixture()
  const response = await f.post({ action: 'list', query: "  O'Reilly_%  ", area: '연구', experience: '신입', status: 'unread' })
  assert.equal(response.status,200)
  assert.equal(f.calls.at(-1)[1].p_query, "O'Reilly_%")
  assert.equal(f.calls.at(-1)[1].p_area, '연구')
  assert.equal(f.calls.at(-1)[1].p_experience, '신입')
  for(const query of ['x'.repeat(101), 'bad\u0000', {}, ['name']]) {
    assert.equal((await f.post({ action:'list',query })).status,400)
  }
})
