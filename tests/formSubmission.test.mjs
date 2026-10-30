import assert from 'node:assert/strict'
import { test } from 'node:test'
import { submitForm, SubmissionError } from '../src/services/formSubmission.ts'

const input = {
  kind: 'contact', language: 'ko', consent: true, website: '', startedAt: Date.now() - 10_000,
  fields: { name: 'Test', email: 'test@example.test', inquiryType: 'Other', organization: '', message: 'Test inquiry' },
}

test('response loss preserves the receipt and a retry checks status without creating or sending again', async t => {
  const actions = []
  let accepted = false
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const body = JSON.parse(options.body)
    actions.push(body.action)
    if (body.action === 'start') return Response.json({ id: 'receipt-1', token: 'opaque-token', files: [] })
    if (body.action === 'submit') throw new TypeError('Connection lost after dispatch')
    assert.equal(body.token, 'opaque-token')
    return Response.json({ id: 'receipt-1', status: accepted ? 'sent' : 'uncertain' })
  })
  await assert.rejects(submitForm(input, [], () => {}), error => {
    assert.ok(error instanceof SubmissionError)
    assert.equal(error.code, 'DELIVERY_UNCERTAIN')
    assert.equal(error.receiptId, 'receipt-1')
    return true
  })
  assert.deepEqual(actions, ['start', 'submit', 'status'])
  accepted = true
  assert.equal(await submitForm(input, [], () => {}), 'receipt-1')
  assert.deepEqual(actions, ['start', 'submit', 'status', 'status'])
})

test('explicit pre-dispatch rejection permits a corrected submission', async t => {
  let starts = 0
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const { action } = JSON.parse(options.body)
    if (action === 'start') {
      starts++
      return Response.json({ id: `receipt-${starts}`, token: 'opaque-token', files: [] })
    }
    assert.equal(action, 'submit')
    if (starts === 1) return Response.json({ error: 'UPLOAD_INCOMPLETE' }, { status: 409 })
    return Response.json({ id: 'receipt-2', status: 'sent' })
  })
  await assert.rejects(submitForm(input, [], () => {}), { code: 'UPLOAD_INCOMPLETE' })
  assert.equal(await submitForm(input, [], () => {}), 'receipt-2')
  assert.equal(starts, 2)
})

async function recruitClient(t) {
  const storage = new Map()
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
  t.after(() => {
    if (previousStorage) Object.defineProperty(globalThis, 'sessionStorage', previousStorage)
    else delete globalThis.sessionStorage
  })
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  } })
  const client = await import(`../src/services/formSubmission.ts?test=${crypto.randomUUID()}`)
  const selected = ['application', 'degree', 'transcript'].map(group => ({
    group, file: new File(['%PDF-test'], `${group}.pdf`, { type: 'application/pdf' }),
  }))
  const application = { ...input, kind: 'careers', fields: {
    name: 'Candidate', email: 'candidate@example.test', phone: '010-0000-0000',
    area: 'Other', education: 'Other', experience: 'New', message: '',
  } }
  const session = { id: crypto.randomUUID(), token: 'opaque-test-token', status: 'ready',
    files: selected.map(({ group, file }) => ({ group, name: file.name, size: file.size, uploaded: true })) }
  return { client, selected, application, session, storage }
}

test('careers start response loss preserves a random key without storing applicant data', async t => {
  const { client, selected, application, session, storage } = await recruitClient(t)
  const keys = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/forms') // current Vercel origin; never hardcoded mycodx.com
    const body = JSON.parse(options.body)
    if (body.action === 'start') {
      keys.push(body.idempotencyKey)
      const saved = storage.get('mycodx-recruit-operation-v1')
      assert.ok(saved.includes(body.idempotencyKey))
      for (const privateValue of ['candidate@example.test', '010-0000-0000', 'application.pdf', '%PDF']) {
        assert.equal(saved.includes(privateValue), false)
      }
      if (keys.length === 1) throw new Error('lost start response')
      return Response.json(session)
    }
    assert.equal(body.action, 'submit')
    assert.deepEqual(Object.keys(body).sort(), ['action', 'token'])
    return Response.json({ status: 'submitted' })
  })
  await assert.rejects(client.submitForm(application, selected, () => {}))
  assert.equal(await client.submitForm(application, selected, () => {}), session.id)
  assert.equal(keys.length, 2)
  assert.equal(keys[0], keys[1])
})

test('careers committed response loss is confirmed by DB status without a new submission', async t => {
  const { client, selected, application, session } = await recruitClient(t)
  const actions = []
  let saved = false
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const body = JSON.parse(options.body)
    actions.push(body.action)
    if (body.action === 'start') return Response.json(session)
    if (body.action === 'submit') throw new Error('request outcome unknown')
    return Response.json({ status: saved ? 'submitted' : 'ready' })
  })
  await assert.rejects(client.submitForm(application, selected, () => {}), { code: 'RECRUIT_UNCERTAIN' })
  saved = true
  assert.equal(await client.submitForm(application, selected, () => {}), session.id)
  assert.deepEqual(actions, ['start', 'submit', 'status', 'status'])
})

test('careers retry after interrupted upload reuses the operation and already uploaded files', async t => {
  const { client, selected, application, session } = await recruitClient(t)
  const actions = []
  const keys = []
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const body = JSON.parse(options.body)
    actions.push(body.action)
    if (body.action === 'start') { keys.push(body.idempotencyKey); return Response.json(session) }
    return Response.json({ status: body.action === 'status' ? 'ready' : 'submitted' })
  })
  await assert.rejects(client.submitForm(application, selected, stage => {
    if (stage === 'uploading') throw new Error('tab interrupted before dispatch')
  }))
  assert.equal(await client.submitForm(application, selected, () => {}), session.id)
  assert.deepEqual(actions, ['start', 'status', 'start', 'submit'])
  assert.equal(keys[0], keys[1])
})

test('editing a submission with an uncertain commit never creates a new application', async t => {
  const { client, selected, application, session } = await recruitClient(t)
  let starts = 0
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const { action } = JSON.parse(options.body)
    if (action === 'start') { starts++; return Response.json(session) }
    if (action === 'submit') throw new Error('timeout')
    return Response.json({ status: 'ready' })
  })
  await assert.rejects(client.submitForm(application, selected, () => {}), { code: 'RECRUIT_UNCERTAIN' })
  const changed = { ...application, fields: { ...application.fields, phone: '010-9999-9999' } }
  await assert.rejects(client.submitForm(changed, selected, () => {}), { code: 'RECRUIT_UNCERTAIN' })
  assert.equal(starts, 1)
})

test('concurrent careers clicks share one in-flight operation', async t => {
  const { client, selected, application, session } = await recruitClient(t)
  let starts = 0, submits = 0
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const { action } = JSON.parse(options.body)
    if (action === 'start') { starts++; return Response.json(session) }
    submits++
    return Response.json({ status: 'submitted' })
  })
  assert.deepEqual(await Promise.all([client.submitForm(application, selected, () => {}), client.submitForm(application, selected, () => {})]), [session.id, session.id])
  assert.equal(starts, 1)
  assert.equal(submits, 1)
})
