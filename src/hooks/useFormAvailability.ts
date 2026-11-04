import { useEffect, useState } from 'react'
import { watchFormAvailability } from '../services/formAvailability'

export default function useFormAvailability(kind: 'contact' | 'careers' = 'contact') {
  const [available, setAvailable] = useState<boolean | null>(null)
  useEffect(() => watchFormAvailability(kind, setAvailable), [kind])
  return available
}
