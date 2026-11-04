import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { createRecruitDatabase, sha256 } from '../server/supabase.ts'
import { getConfig } from '../server/config.ts'
import { createRecruitmentService } from '../server/recruitment.ts'
import { recruitDatabaseFixture } from './recruit-fixture.mjs'
import { FormError } from '../server/validation.ts'

const config = getConfig({ SUPABASE_URL: 'https://project-test.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test_only' })
const bytes = Buffer.from('%PDF-test')
function file() {
  const id = randomUUID(), application_id = randomUUID()
  return { id, application_id, extension: 'pdf', object_path: `v1/${application_id}/${id}.pdf`, size_bytes: bytes.length, content_type: 'application/pdf' }
}

test('RPC uses only the server API key, bounded JSON and fixed allowlisted endpoints', async () => {
  let calls = 0
  const database = createRecruitDatabase(config, async (url, init) => {
    calls++
    assert.equal(url, `${config.supabaseUrl}/rest/v1/rpc/recruit_submission_status`)
    assert.equal(init.headers.apikey, config.supabaseSecretKey)
    assert.equal(init.headers.Authorization, undefined)
    assert.equal(init.redirect, 'error')
    assert.equal(init.cache, 'no-store')
    assert.ok(init.signal)
    return Response.json({ stage: 'submitted' })
  })
  assert.deepEqual(await database.rpc('recruit_submission_status', { p_application_id: randomUUID() }), { stage: 'submitted' })
  await assert.rejects(database.rpc('../../admin', {}))
  assert.equal(calls, 1)
  await assert.rejects(createRecruitDatabase({ ...config, supabaseUrl: 'https://attacker.test' }, () => {
    assert.fail('secret must not leave the configured Supabase project')
  }).rpc('recruit_submission_status', {}))
})

test('raw database errors containing candidate data are replaced by safe codes', async () => {
  const database = createRecruitDatabase(config, async () => Response.json({
    message: 'Duplicate row for candidate@example.test', details: 'sensitive contents',
  }, { status: 400 }))
  await assert.rejects(database.rpc('recruit_begin_application', {}), { code: 'UNAVAILABLE' })
  const conflict = createRecruitDatabase(config, async () => Response.json({ message: 'IDEMPOTENCY_CONFLICT' }, { status: 400 }))
  await assert.rejects(conflict.rpc('recruit_begin_application', {}), { code: 'IDEMPOTENCY_CONFLICT' })
  const overflow = createRecruitDatabase(config, async () => new Response('x'.repeat(33 * 1024)))
  await assert.rejects(overflow.rpc('recruit_submission_status', {}), { code: 'UNAVAILABLE' })
})

test('void RPCs accept successful empty responses, including HTTP 204 with no body stream', async () => {
  for (const name of ['recruit_verify_file', 'recruit_finish_notification']) {
    for (const makeResponse of [() => new Response(null, { status: 204 }), () => new Response('')]) {
      const database = createRecruitDatabase(config, async () => makeResponse())
      assert.equal(await database.rpc(name, {}), null)
    }
  }
})

test('empty error responses and missing JSON results are never treated as successful RPCs', async () => {
  for (const status of [400, 401, 403, 500]) {
    const database = createRecruitDatabase(config, async () => new Response(null, { status }))
    await assert.rejects(database.rpc('recruit_verify_file', {}), error => {
      assert.equal(error.code, 'UNAVAILABLE')
      assert.equal(error.diagnostic.httpStatus, status)
      return true
    })
  }
  for (const name of ['recruit_begin_application', 'recruit_submission_status', 'recruit_finalize_application', 'recruit_claim_notification']) {
    for (const makeResponse of [() => new Response(null, { status: 204 }), () => new Response(''), () => new Response('{broken')]) {
      await assert.rejects(createRecruitDatabase(config, async () => makeResponse()).rpc(name, {}), { code: 'UNAVAILABLE' })
    }
  }
})

test('recruitment finishes saving and records one mail receipt with real adapter handling void HTTP responses', async () => {
  const now = Date.now()
  const fixture = recruitDatabaseFixture(now)
  const httpCalls = []
  const database = createRecruitDatabase(config, async (url, init) => {
    const path = new URL(url).pathname
    httpCalls.push(path)
    if (path.startsWith('/rest/v1/rpc/')) {
      const name = path.split('/').at(-1)
      const result = await fixture.database.rpc(name, JSON.parse(init.body))
      return ['recruit_verify_file', 'recruit_finish_notification'].includes(name)
        ? new Response(null, { status: 204 }) : Response.json(result)
    }
    const objectPath = path.replace('/storage/v1/object/recruit-files/', '')
    if (init.method === 'POST') {
      fixture.objects.set(objectPath, Buffer.from(init.body))
      return Response.json({})
    }
    return new Response(fixture.objects.get(objectPath))
  })
  const json = new Map(), uploaded = new Map(), sent = []
  const store = {
    async createJson(path, value) { if (json.has(path)) return false; json.set(path, value); return true },
    async readJson(path) { return json.get(path) ?? null },
    async readFile(path) { if (!uploaded.has(path)) throw new FormError('UPLOAD_INCOMPLETE', 409); return uploaded.get(path) },
    async uploadToken() { return 'test-upload-token' },
  }
  const service = createRecruitmentService({
    config: { ...config, enabled: true, mailProvider: 'smtp', signingSecret: 'test-secret-with-at-least-thirty-two-characters', testTo: 'tester@example.test' },
    database, store, now: () => now,
    sendMail: async mail => { sent.push(mail); return { messageId: 'test-message-id' } },
  })
  const session = await service.start({
    kind: 'careers', language: 'ko', consent: true, website: '', startedAt: now - 5000,
    fields: { name: 'Test', email: 'applicant@example.test', phone: '010-0000-0000', area: 'Other', education: 'Other', experience: 'New', message: '' },
    files: ['application', 'degree', 'transcript'].map(group => ({ group, name: `${group}.pdf`, size: bytes.length })),
  }, randomUUID())
  for (const file of session.files) uploaded.set(file.pathname, bytes)
  const manifest = [...json.values()][0]
  assert.equal((await service.handle('submit', manifest)).status, 'submitted')
  assert.equal(fixture.applications.get(session.id).stage, 'submitted')
  assert.ok(fixture.applications.get(session.id).files.every(file => file.ready))
  assert.equal(fixture.notifications.get(session.id).status, 'accepted')
  assert.equal((await service.handle('submit', manifest)).status, 'submitted')
  assert.equal(sent.length, 1)
  assert.equal(sent[0].attachments.length, 3)
  assert.equal(httpCalls.filter(path => path.endsWith('/recruit_verify_file')).length, 3)
  assert.equal(httpCalls.filter(path => path.endsWith('/recruit_finish_notification')).length, 1)
})

test('storage verifies persisted bytes after success, existing-object conflict, or lost upload response', async () => {
  for (const outcome of ['success', 'conflict', 'timeout']) {
    const metadata = file()
    const calls = []
    const database = createRecruitDatabase(config, async (url, init) => {
      calls.push(init.method)
      assert.equal(url, `${config.supabaseUrl}/storage/v1/object/recruit-files/${metadata.object_path}`)
      assert.equal(init.redirect, 'error')
      if (init.method === 'POST') {
        assert.equal(init.headers['x-upsert'], 'false')
        assert.deepEqual(init.body, bytes)
        if (outcome === 'timeout') throw new Error('upload receipt lost')
        return Response.json({}, { status: outcome === 'conflict' ? 400 : 200 })
      }
      return new Response(bytes)
    })
    assert.equal(await database.persistFile(metadata, bytes), sha256(bytes))
    assert.deepEqual(calls, ['POST', 'GET'])
  }
})

test('storage rejects changed bytes, oversized reads, missing objects and injected paths', async () => {
  for (const [body, status, code] of [[Buffer.from('XXXXXXXXX'), 200, 'FILE_CONFLICT'], [Buffer.alloc(20), 200, 'UNAVAILABLE'], ['', 404, 'UNAVAILABLE']]) {
    const database = createRecruitDatabase(config, async (_url, init) => init.method === 'POST'
      ? Response.json({}) : new Response(body, { status }))
    await assert.rejects(database.persistFile(file(), bytes), { code })
  }
  const database = createRecruitDatabase(config, () => assert.fail('must not fetch user URLs'))
  await assert.rejects(database.persistFile({ ...file(), object_path: 'https://attacker.test/file' }, bytes))
})
