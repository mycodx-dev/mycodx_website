import assert from 'node:assert/strict'
import { test } from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { watchFormAvailability } from '../src/services/formAvailability.ts'

function sources(fetcher) {
  const page = new EventTarget()
  page.visibilityState = 'visible'
  return { fetcher, page, events: new EventTarget() }
}

test('browser fetch is called without binding the sources object as its receiver', async t => {
  const values = []
  const receivers = []
  const source = sources(async function () {
    receivers.push(this)
    // Window.fetch rejects an arbitrary receiver before making any HTTP request.
    if (this !== undefined) throw new TypeError('Illegal invocation')
    return Response.json({ enabled: true, careersEnabled: true })
  })
  t.after(watchFormAvailability('careers', value => values.push(value), source))
  await setImmediate()
  source.events.dispatchEvent(new Event('focus'))
  await setImmediate()
  assert.deepEqual(receivers, [undefined, undefined])
  assert.deepEqual(values, [true, true])
})

test('a failed availability request recovers on focus without reloading form inputs', async t => {
  const values = []
  let count = 0
  const source = sources(async (_url, options) => {
    assert.equal(options.cache, 'no-store')
    if (++count === 1) throw new Error('connection lost')
    return Response.json({ enabled: true, careersEnabled: true })
  })
  const stop = watchFormAvailability('contact', value => values.push(value), source)
  t.after(stop)
  await setImmediate()
  assert.deepEqual(values, [false])
  source.events.dispatchEvent(new Event('focus'))
  await setImmediate()
  assert.deepEqual(values, [false, true])
})

test('careers uses careersEnabled while contact uses enabled', async t => {
  const result = { enabled: false, careersEnabled: true }
  const contact = [], careers = []
  t.after(watchFormAvailability('contact', value => contact.push(value), sources(async () => Response.json(result))))
  t.after(watchFormAvailability('careers', value => careers.push(value), sources(async () => Response.json(result))))
  await setImmediate()
  assert.deepEqual(contact, [false])
  assert.deepEqual(careers, [true])
})

test('late response from an older request cannot disable a recovered form', async t => {
  let resolveOld, count = 0
  const values = []
  const source = sources(async () => {
    if (++count === 1) return new Promise(resolve => { resolveOld = resolve })
    return Response.json({ enabled: true })
  })
  t.after(watchFormAvailability('contact', value => values.push(value), source))
  source.events.dispatchEvent(new Event('online'))
  await setImmediate()
  assert.deepEqual(values, [true])
  resolveOld(Response.json({ enabled: false }))
  await setImmediate()
  assert.deepEqual(values, [true])
})

test('returning to a visible tab rechecks; unmount aborts and removes all event listeners', async () => {
  let calls = 0, signal, resolveLast
  const source = sources(async (_url, options) => {
    calls++
    signal = options.signal
    return new Promise(resolve => { resolveLast = resolve })
  })
  const values = []
  const stop = watchFormAvailability('careers', value => values.push(value), source)
  source.page.visibilityState = 'hidden'
  source.events.dispatchEvent(new Event('focus'))
  source.page.dispatchEvent(new Event('visibilitychange'))
  assert.equal(calls, 1)
  source.page.visibilityState = 'visible'
  source.page.dispatchEvent(new Event('visibilitychange'))
  assert.equal(calls, 2)
  stop()
  assert.equal(signal.aborted, true)
  source.events.dispatchEvent(new Event('online'))
  source.events.dispatchEvent(new Event('focus'))
  source.page.dispatchEvent(new Event('visibilitychange'))
  assert.equal(calls, 2)
  resolveLast(Response.json({ careersEnabled: true }))
  await setImmediate()
  assert.deepEqual(values, [])
})
