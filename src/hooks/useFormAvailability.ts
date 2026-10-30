import { useEffect, useState } from 'react'
import { FORM_API } from '../../shared/forms'

export default function useFormAvailability() {
  const [available, setAvailable] = useState<boolean | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    fetch(FORM_API, { signal: controller.signal, cache: 'no-store' })
      .then(async response => response.ok ? response.json() : { enabled: false })
      .then(data => setAvailable(data.enabled === true))
      .catch(() => setAvailable(false))
      .finally(() => clearTimeout(timeout))
    return () => { clearTimeout(timeout); controller.abort() }
  }, [])
  return available
}
