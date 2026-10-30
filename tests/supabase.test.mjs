import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { createRecruitDatabase, sha256 } from '../server/supabase.ts'
import { getConfig } from '../server/config.ts'

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
