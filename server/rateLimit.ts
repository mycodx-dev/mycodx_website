import { STORAGE_PREFIX } from './storage.ts'
import type { FormsStore } from './storage.ts'
import { FormError } from './validation.ts'

export async function takeRateSlot(store: FormsStore, scope: string, limit: number, now: number) {
  const hour = Math.floor(now / 3_600_000)
  for (let slot = 0; slot < limit; slot++) {
    if (await store.createJson(`${STORAGE_PREFIX}rate/${hour}/${scope}/${slot}.json`, { createdAt: now })) return
  }
  throw new FormError('RATE_LIMITED', 429)
}
