import { STORAGE_PREFIX } from './storage.ts'
import type { FormsStore } from './storage.ts'
import { FormError } from './validation.ts'

export async function takeRateSlot(store: FormsStore, scope: string, limit: number, now: number) {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new FormError('RATE_LIMITED', 429)
  const hour = Math.floor(now / 3_600_000)
  const path = (slot: number) => `${STORAGE_PREFIX}rate/${hour}/${scope}/${slot}.json`
  // Keep the empty bucket fast. Existing buckets used to attempt a remote write
  // AND conflict read for every occupied slot (up to 100 sequential attempts).
  if (await store.createJson(path(0), { createdAt: now })) return
  let low = 1
  while (low < limit) {
    let high = limit
    // Slots are filled in order and retained longer than the rate-limit window.
    // Find the first available slot with reads, then claim it atomically. These
    // reads are hints only: never authorize a request without a successful write.
    while (low < high) {
      const middle = Math.floor((low + high) / 2)
      if (await store.readJson(path(middle)) !== null) low = middle + 1
      else high = middle
    }
    if (low === limit) break
    if (await store.createJson(path(low), { createdAt: now })) return
    // Another invocation won the same slot. Search the remaining suffix.
    low++
  }
  throw new FormError('RATE_LIMITED', 429)
}
