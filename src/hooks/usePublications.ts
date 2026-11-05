import { useEffect, useRef, useState } from 'react'
import type { PublicPublicationsResult, PublicPublication } from '../../shared/publications'
import { researchPublications } from '../data/publications'
import { readPublications } from '../services/publications'

export default function usePublications() {
  const [items, setItems] = useState<PublicPublication[]>([])
  const [cursor, setCursor] = useState<PublicPublicationsResult['nextCursor']>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  const controller = useRef<AbortController | null>(null)
  const pending = useRef(false)
  useEffect(() => {
    const abort = new AbortController(); controller.current = abort; pending.current = false
    fetch('/api/publications', { cache: 'no-store', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]) })
      .then(readPublications).then(result => {
        if (!abort.signal.aborted) {
          setItems(result.enabled ? result.items : researchPublications.map(item => ({ ...item, id: item.doi })))
          setCursor(result.enabled ? result.nextCursor : null); setError(false)
        }
      }).catch(() => { if (!abort.signal.aborted) { setItems([]); setCursor(null); setError(true) } })
      .finally(() => { if (!abort.signal.aborted) { setLoading(false); setLoadingMore(false) } })
    return () => abort.abort()
  }, [revision])
  async function more() {
    if (!cursor || pending.current || !controller.current) return
    const signal = controller.current.signal
    pending.current = true; setLoadingMore(true)
    try {
      const params = new URLSearchParams({ beforeYear: String(cursor.year), beforeId: cursor.id })
      const result = await readPublications(await fetch(`/api/publications?${params}`, {
        cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      }))
      if (!result.enabled) throw new Error('Publications mode changed')
      if (!signal.aborted) {
        setItems(old => [...old, ...result.items.filter(item => !old.some(previous => previous.id === item.id))])
        setCursor(result.nextCursor); setError(false)
      }
    } catch { if (!signal.aborted) setError(true) }
    finally { if (!signal.aborted) { pending.current = false; setLoadingMore(false) } }
  }
  return { items, loading, loadingMore, error, hasMore: !!cursor, more,
    retry: () => { setLoading(true); setError(false); setItems([]); setCursor(null); setRevision(v => v + 1) } }
}
