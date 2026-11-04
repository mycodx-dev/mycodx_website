import { FORM_API } from '../../shared/forms.ts'
import type { FormKind } from '../../shared/forms.ts'

interface AvailabilitySources {
  fetcher: typeof fetch
  events: EventTarget
  page: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>
}

// Recheck when the user returns from deployment settings or reconnects. Keep the
// form's input intact and ignore responses from superseded/unmounted requests.
export function watchFormAvailability(
  kind: FormKind,
  onChange: (available: boolean) => void,
  sources: AvailabilitySources = { fetcher: fetch, events: window, page: document },
) {
  // Window.fetch must not receive the sources object as its `this` value.
  const { fetcher } = sources
  let active = true
  let controller: AbortController | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined

  const refresh = async () => {
    controller?.abort()
    clearTimeout(timeout)
    const current = new AbortController()
    controller = current
    const timer = setTimeout(() => current.abort(), 10_000)
    timeout = timer
    try {
      const response = await fetcher(FORM_API, { signal: current.signal, cache: 'no-store' })
      const result = response.ok ? await response.json() : null
      if (active && controller === current) {
        onChange((kind === 'careers' ? result?.careersEnabled : result?.enabled) === true)
      }
    } catch {
      if (active && controller === current) onChange(false)
    } finally { clearTimeout(timer) }
  }
  const recheck = () => { if (sources.page.visibilityState === 'visible') void refresh() }
  void refresh()
  sources.events.addEventListener('focus', recheck)
  sources.events.addEventListener('online', recheck)
  sources.page.addEventListener('visibilitychange', recheck)
  return () => {
    active = false
    controller?.abort()
    clearTimeout(timeout)
    sources.events.removeEventListener('focus', recheck)
    sources.events.removeEventListener('online', recheck)
    sources.page.removeEventListener('visibilitychange', recheck)
  }
}
