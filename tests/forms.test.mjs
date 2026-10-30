import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { getConfig } from '../server/config.ts'
import { createFormsHandler, submissionPath } from '../server/forms.ts'
import { buildMail, sendSubmission } from '../server/mail.ts'
import { signSession, verifySession, SESSION_TTL } from '../server/tokens.ts'
import { validateSubmission } from '../server/validation.ts'
import { MAX_TOTAL_FILE_SIZE } from '../shared/forms.ts'

const NOW = Date.UTC(2026, 9, 29, 12)
const origin = 'https://www.example.test'
const configuredEnv = {
  MAIL_FORMS_ENABLED: 'true', FORM_ALLOWED_ORIGINS: origin,
  FORM_SIGNING_SECRET: 'test-only-secret-that-is-longer-than-thirty-two-characters',
  CRON_SECRET: 'test-only-cron-secret-that-is-longer-than-thirty-two-characters',
  BLOB_READ_WRITE_TOKEN: 'test-only-blob-token',
  MAIL_FROM: 'website@example.test', RESEND_API_KEY: 're_test_only_not_a_real_key',
  CONTACT_TO: 'contact@example.test', CAREERS_TO: 'careers@example.test',
}
const config = getConfig(configuredEnv)

function input(kind = 'contact') {
  return {
    kind, language: 'ko', consent: true, website: '', startedAt: NOW - 10_000,
    fields: kind === 'contact'
      ? { name: 'Test Person', email: 'applicant@example.test', inquiryType: 'Partnership', organization: '', message: 'Test inquiry' }
      : { name: 'Test Person', email: 'applicant@example.test', phone: '010-0000-0000', area: 'Other', education: 'Other', experience: 'New', message: '' },
    files: kind === 'contact' ? [] : ['application', 'degree', 'transcript'].map(group => ({ group, name: 'same.pdf', size: 16 })),
  }
}

function fixture(options = {}) {
  const json = new Map()
  const files = new Map()
  const sent = []
  const store = {
    async readJson(path) { return json.get(path) ?? null },
    async createJson(path, value) {
      if (options.failReceipt && path.endsWith('/sent.json')) throw new Error('Storage unavailable after provider accepted')
      if (json.has(path)) return false
      json.set(path, structuredClone(value))
      return true
    },
    async readFile(path, expectedSize) {
      const bytes = files.get(path)
      if (!bytes || bytes.byteLength !== expectedSize) {
        const { FormError } = await import('../server/validation.ts')
        throw new FormError('UPLOAD_INCOMPLETE', 409)
      }
      return bytes
    },
    async uploadToken(file) { return `limited-token:${file.pathname}` },
  }
  const newHandler = () => createFormsHandler({
    config: options.config ?? config, store, now: () => NOW,
    sendMail: async message => {
      sent.push(message)
      if (options.failMail) throw new Error('Ambiguous provider timeout')
      return { messageId: 'test-message-id' }
    },
  })
  let handler = newHandler()
  async function post(body, headers = {}) {
    return handler(new Request(`${origin}/api/forms`, { method: 'POST', headers: {
      origin, 'content-type': 'application/json', ...headers,
    }, body: JSON.stringify(body) }))
  }
  async function start(submission = input()) {
    const response = await post({ action: 'start', submission })
    assert.equal(response.status, 201)
    return response.json()
  }
  function upload(session) {
    for (const file of session.files) {
      const bytes = Buffer.alloc(file.size, 0x20)
      bytes.write('%PDF-1.7')
      files.set(file.pathname, bytes)
    }
  }
  return { json, files, sent, handler, post, start, upload, restart: () => { handler = newHandler() } }
}

test('configuration defaults closed and never exposes secrets to the client', async () => {
  const f = fixture({ config: getConfig({}) })
  const response = await f.handler(new Request(`${origin}/api/forms`))
  assert.deepEqual(await response.json(), { enabled: false, maxTotalBytes: MAX_TOTAL_FILE_SIZE, maxFiles: 10 })
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(f.sent.length, 0)
  assert.equal(getConfig({ ...configuredEnv, MAIL_FROM: 'bad\r\nBcc:someone@example.test' }).enabled, false)
  assert.equal(getConfig({ ...configuredEnv, RESEND_API_KEY: '' }).enabled, false)
  assert.equal(getConfig({ ...configuredEnv, VERCEL_ENV: 'preview' }).enabled, false)
  assert.equal(getConfig({ ...configuredEnv, VERCEL_ENV: 'preview', MAIL_TEST_RECIPIENT: 'tester@example.test' }).enabled, true)
})

test('rejects cross-origin, non-JSON and oversized bodies without writing or sending', async () => {
  const f = fixture()
  assert.equal((await f.post({ action: 'start', submission: input() }, { origin: 'https://attacker.test' })).status, 403)
  assert.equal((await f.post({}, { 'content-type': 'text/plain' })).status, 415)
  assert.equal((await f.post({ text: 'x'.repeat(25 * 1024) })).status, 413)
  assert.equal(f.json.size, 0)
  assert.equal(f.sent.length, 0)
})

test('requires consent, rejects honeypot and header injection', async () => {
  const f = fixture()
  for (const submission of [
    { ...input(), consent: false }, { ...input(), website: 'spam' },
    { ...input(), fields: { ...input().fields, email: 'a@example.test\r\nBcc: x@example.test' } },
    { ...input(), fields: { ...input().fields, name: 'Name\nInjected' } },
  ]) assert.equal((await f.post({ action: 'start', submission })).status, 400)
  assert.equal(f.json.size, 0)
})

test('validates all required file groups, total size, file count, names and types', () => {
  const base = input('careers')
  for (const files of [
    base.files.slice(0, 2),
    base.files.map(file => ({ ...file, size: 4 * 1024 * 1024 })),
    [...base.files, ...Array.from({ length: 8 }, () => ({ group: 'papers', name: 'a.pdf', size: 10 }))],
    base.files.map(file => ({ ...file, name: '../a.pdf' })),
    base.files.map(file => ({ ...file, name: 'a.exe' })),
    base.files.map(file => ({ ...file, size: 0 })),
  ]) assert.throws(() => validateSubmission({ ...base, files }, NOW))
})

test('attachment bytes larger than 4.5 MB stay out of the API request and reach mail intact', async () => {
  const f = fixture()
  const submission = input('careers')
  submission.files[0].size = 6 * 1024 * 1024
  const session = await f.start(submission)
  assert.ok(JSON.stringify({ action: 'submit', token: session.token }).length < 1024)
  assert.equal(session.files.length, 3)
  assert.equal(new Set(session.files.map(file => file.pathname)).size, 3)
  assert.ok(session.files.every(file => !file.pathname.includes('same.pdf')))
  f.upload(session)
  const result = await (await f.post({ action: 'submit', token: session.token })).json()
  assert.equal(result.status, 'sent')
  assert.equal(f.sent[0].attachments[0].content.byteLength, 6 * 1024 * 1024)
  for (const [index, attachment] of f.sent[0].attachments.entries()) {
    assert.deepEqual(attachment.content, f.files.get(session.files[index].pathname))
  }
})

test('incomplete uploads never dispatch an email; completion allows the same session', async () => {
  const f = fixture()
  const session = await f.start(input('careers'))
  const failed = await f.post({ action: 'submit', token: session.token })
  assert.equal(failed.status, 409)
  assert.equal(f.sent.length, 0)
  assert.equal(f.json.has(`${submissionPath(session.id, NOW)}dispatch.json`), false)
  f.upload(session)
  assert.equal((await (await f.post({ action: 'submit', token: session.token })).json()).status, 'sent')
})

test('file signature mismatch is rejected before sending and uploaded paths cannot be supplied by a client', async () => {
  const f = fixture()
  const session = await f.start(input('careers'))
  f.upload(session)
  f.files.set(session.files[0].pathname, Buffer.alloc(16, 0))
  const response = await f.post({ action: 'submit', token: session.token, files: [{ url: 'http://169.254.169.254/' }] })
  assert.equal(response.status, 400)
  assert.equal((await response.json()).error, 'FILE_TYPE')
  assert.equal(f.sent.length, 0)
})

test('simultaneous submissions, retries and response loss produce only one mail', async () => {
  const f = fixture()
  const session = await f.start()
  await Promise.all([
    f.post({ action: 'submit', token: session.token }),
    f.post({ action: 'submit', token: session.token }),
  ])
  const replay = await f.post({ action: 'submit', token: session.token })
  assert.equal((await replay.json()).status, 'sent')
  assert.equal(f.sent.length, 1)
  assert.equal((await (await f.post({ action: 'status', token: session.token })).json()).status, 'sent')
})

test('provider timeout and receipt-write failure are uncertain and never automatically resend', async () => {
  for (const options of [{ failMail: true }, { failReceipt: true }]) {
    const f = fixture(options)
    const session = await f.start()
    for (let i = 0; i < 2; i++) {
      const response = await f.post({ action: 'submit', token: session.token })
      assert.equal((await response.json()).status, 'uncertain')
    }
    assert.equal(f.sent.length, 1)
  }
})

test('session tokens cannot be forged or used after upload expiry; status remains readable', () => {
  const token = signSession(randomUUID(), NOW, config.signingSecret)
  assert.throws(() => verifySession(`${token}x`, config.signingSecret, NOW))
  assert.throws(() => verifySession(token, 'wrong-secret', NOW))
  assert.throws(() => verifySession(token, config.signingSecret, NOW + SESSION_TTL))
  assert.ok(verifySession(token, config.signingSecret, NOW + SESSION_TTL, true))
})

test('rate limit survives new function instances by using shared durable storage', async () => {
  const f = fixture()
  for (let index = 0; index < 5; index++) await f.start()
  f.restart()
  const response = await f.post({ action: 'start', submission: input() })
  assert.equal(response.status, 429)
  assert.equal((await response.json()).error, 'RATE_LIMITED')
})

test('mail recipients are server-controlled, Reply-To is the applicant and same names stay distinct', () => {
  const mail = buildMail({
    id: randomUUID(), kind: 'careers', language: 'ko', createdAt: NOW,
    fields: input('careers').fields,
    attachments: [1, 2].map(() => ({ group: 'degree', name: 'same.pdf', contentType: 'application/pdf', content: Buffer.from('%PDF-test') })),
  }, config)
  assert.deepEqual(mail.to, ['careers@example.test'])
  assert.equal(mail.from, 'MycoDx 홈페이지 <website@example.test>')
  assert.equal(mail.reply_to, 'applicant@example.test')
  assert.notEqual(mail.attachments[0].filename, mail.attachments[1].filename)
  assert.deepEqual(mail.attachments[0].content, mail.attachments[1].content)
  assert.deepEqual(Buffer.from(mail.attachments[0].content, 'base64'), Buffer.from('%PDF-test'))
  assert.ok(mail.attachments.every(file => !('path' in file)))
})

test('Resend receives base64 attachments, fixed recipients and a stable idempotency key', async () => {
  const bytes = Buffer.alloc(6 * 1024 * 1024, 0x20)
  bytes.write('%PDF-1.7')
  const submission = {
    id: randomUUID(), kind: 'careers', language: 'ko', createdAt: NOW,
    fields: input('careers').fields,
    attachments: [{ group: 'application', name: 'test.pdf', contentType: 'application/pdf', content: bytes }],
  }
  const requests = []
  const fetcher = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails')
    assert.equal(options.method, 'POST')
    assert.equal(options.redirect, 'error')
    assert.equal(options.headers.Authorization, `Bearer ${config.resendApiKey}`)
    assert.equal(options.headers['Idempotency-Key'], `mycodx-form/${submission.id}`)
    const body = JSON.parse(options.body)
    assert.deepEqual(body.to, ['tester@example.test'])
    assert.equal(body.reply_to, 'applicant@example.test')
    assert.ok(body.subject.startsWith('[TEST]'))
    assert.deepEqual(Buffer.from(body.attachments[0].content, 'base64'), bytes)
    assert.equal('path' in body.attachments[0], false)
    requests.push(options.body)
    return Response.json({ id: 'resend-test-receipt' })
  }
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(await sendSubmission(submission, { ...config, testTo: 'tester@example.test' }, fetcher), { messageId: 'resend-test-receipt' })
  }
  assert.equal(requests[0], requests[1])
  for (const response of [Response.json({ message: 'Rejected' }, { status: 403 }), Response.json({})]) {
    await assert.rejects(sendSubmission(submission, config, async () => response))
  }
})
