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
