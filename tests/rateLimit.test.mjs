import { test } from 'node:test'
import assert from 'node:assert/strict'
import { takeRateSlot } from '../server/rateLimit.ts'
import { STORAGE_PREFIX } from '../server/storage.ts'

const now = Date.UTC(2026, 10, 5)
const hour = Math.floor(now / 3_600_000)
const path = slot => `${STORAGE_PREFIX}rate/${hour}/test/${slot}.json`
function fixture(used = 0) {
  const data = new Map(Array.from({ length: used }, (_, i) => [path(i), { createdAt: now }]))
  const calls = { reads: 0, writes: 0 }
  const store = {
    async readJson(key) { calls.reads++; return data.get(key) ?? null },
    async createJson(key, value) {
      calls.writes++
      if (data.has(key)) return false
      data.set(key, value); return true
    },
  }
  return { data, calls, store }
}

test('empty rate bucket requires one write and no extra reads', async () => {
  const f = fixture()
  await takeRateSlot(f.store, 'test', 100, now)
  assert.deepEqual(f.calls, { writes: 1, reads: 0 })
  assert.equal(f.data.size, 1)
})

test('near-full global bucket skips occupied writes with logarithmic reads', async () => {
  const f = fixture(99)
  await takeRateSlot(f.store, 'test', 100, now)
  assert.equal(f.data.size, 100)
  assert.equal(f.calls.writes, 2)
  assert.ok(f.calls.reads <= 7)
  await assert.rejects(takeRateSlot(f.store, 'test', 100, now), { code: 'RATE_LIMITED' })
  assert.equal(f.data.size, 100)
})

test('new instances and concurrent requests share the exact durable quota', async () => {
  const f = fixture()
  const results = await Promise.allSettled(Array.from({ length: 30 }, () => takeRateSlot({ ...f.store }, 'test', 10, now)))
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 10)
  for (const result of results.filter(r => r.status === 'rejected')) assert.equal(result.reason.code, 'RATE_LIMITED')
  assert.equal(f.data.size, 10)
  assert.deepEqual([...f.data.keys()].sort(), Array.from({ length: 10 }, (_, i) => path(i)).sort())
  await assert.rejects(takeRateSlot({ ...f.store }, 'test', 10, now), { code: 'RATE_LIMITED' })
  await takeRateSlot(f.store, 'test', 10, now + 3_600_000)
  assert.equal(f.data.size, 11)
})

test('storage errors fail closed, and a stale missing read never bypasses atomic claims', async () => {
  const f = fixture(9)
  const unavailable = new Error('storage unavailable')
  await assert.rejects(takeRateSlot({ ...f.store, async readJson() { throw unavailable } }, 'test', 10, now), unavailable)
  assert.equal(f.data.size, 9)
  const stale = { ...f.store, async readJson() { return null } }
  await takeRateSlot(stale, 'test', 10, now)
  assert.equal(f.data.size, 10)
  await assert.rejects(takeRateSlot(stale, 'test', 10, now), { code: 'RATE_LIMITED' })
  await assert.rejects(takeRateSlot(f.store, 'test', 0, now), { code: 'RATE_LIMITED' })
})
