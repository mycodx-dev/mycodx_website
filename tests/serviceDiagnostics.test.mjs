import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FormError } from '../server/validation.ts'
import { ServiceOperationError, serviceOperation, serviceFailureLog } from '../server/serviceDiagnostics.ts'
import { createRecruitDatabase } from '../server/supabase.ts'
import { getConfig } from '../server/config.ts'
import { createFormsHandler } from '../server/forms.ts'

const config = getConfig({ SUPABASE_URL: 'https://test-project.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test_only' })

test('RPC network failures identify DNS or timeout without logging URL, key or candidate data', async () => {
  for (const code of ['ENOTFOUND', 'UND_ERR_CONNECT_TIMEOUT']) {
    const database = createRecruitDatabase(config, async () => {
      throw new TypeError('fetch failed sb_secret_test_only candidate@example.test', {
        cause: Object.assign(new Error('test-project.supabase.co'), { code }),
      })
    })
    await assert.rejects(database.rpc('recruit_begin_application', { p_fields: { name: 'private name' } }), error => {
      assert.equal(error.code, 'UNAVAILABLE')
      assert.deepEqual(JSON.parse(serviceFailureLog(error)), {
        event: 'forms_service_error', service: 'supabase', operation: 'recruit_begin_application', reason: code,
      })
      assert.equal(error.cause, undefined)
      return true
    })
  }
})

test('RPC HTTP failures retain only allowlisted codes, never messages or unknown code values', async () => {
  for (const code of ['PGRST202', '42501', 'candidate@example.test']) {
    const database = createRecruitDatabase(config, async () => Response.json({
      code, message: 'private name', details: 'sb_secret_test_only', hint: 'private file path',
    }, { status: 403 }))
    await assert.rejects(database.rpc('recruit_begin_application', {}), error => {
      assert.deepEqual(JSON.parse(serviceFailureLog(error)), {
        event: 'forms_service_error', service: 'supabase', operation: 'recruit_begin_application',
        reason: 'HTTP_ERROR', httpStatus: 403, ...(code === 'candidate@example.test' ? {} : { providerCode: code }),
      })
      return true
    })
  }
})

test('operation wrappers preserve user errors and inner diagnostics, discard unexpected error content', async () => {
  const conflict = new FormError('FILE_CONFLICT', 409)
  await assert.rejects(serviceOperation('blob', 'read_file', async () => { throw conflict }), e => e === conflict)
  const nested = new ServiceOperationError('supabase', 'storage_download', undefined, 401)
  await assert.rejects(serviceOperation('blob', 'read_file', async () => { throw nested }), e => e === nested)
  const unsafe = Object.assign(new Error('candidate@example.test'), { code: 'secret', name: 'private file path' })
  await assert.rejects(serviceOperation('blob', 'upload_token', async () => { throw unsafe }), error => {
    assert.deepEqual(JSON.parse(serviceFailureLog(error)), {
      event: 'forms_service_error', service: 'blob', operation: 'upload_token', reason: 'UNEXPECTED_ERROR',
    })
    return true
  })
})

test('server logs a diagnostic once but public 503 response never includes internal details', async t => {
  const output = []
  t.mock.method(console, 'error', message => output.push(message))
  const handler = createFormsHandler({ config, store: {}, sendMail: async () => {} })
  const failure = new ServiceOperationError('supabase', 'recruit_begin_application', undefined, 404, 'PGRST202')
  // An exception at a handler boundary must pass through the same safe catch path.
  const response = await handler({ get method() { throw failure } })
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: 'UNAVAILABLE' })
  assert.deepEqual(output, [serviceFailureLog(failure)])
})
