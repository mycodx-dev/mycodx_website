import type { FormsConfig } from './config.ts'
import type { RecruitDatabase } from './supabase.ts'
import type { PublicPublication } from '../shared/publications.ts'
import { UUID_PATTERN } from './tokens.ts'
import { FormError } from './validation.ts'
import { serviceFailureLog } from './serviceDiagnostics.ts'

export function createPublicationsHandler(config: FormsConfig, database: RecruitDatabase, enabled: boolean, log = console.error) {
  return async (request: Request) => {
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
    try {
      if (request.method !== 'GET') return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET' } })
      if (!enabled) return Response.json({ enabled: false, items: [], nextCursor: null }, { headers })
      if (!config.supabaseUrl || !config.supabaseSecretKey) throw new FormError('UNAVAILABLE', 503)
      const params = new URL(request.url).searchParams
      const year = params.get('beforeYear'), id = params.get('beforeId')
      if ((year === null) !== (id === null) || (year !== null && (!/^\d{4}$/.test(year) || +year < 1900 || +year > 2200)) ||
        (id !== null && !UUID_PATTERN.test(id))) throw new FormError('INVALID_FIELDS')
      const rows = await database.rpc<PublicPublication[]>('publications_public_list', { p_before_year: year === null ? null : +year, p_before_id: id })
      const items = rows.slice(0, 20), last = items.at(-1)
      return Response.json({ enabled: true, items, nextCursor: rows.length > 20 && last ? { year: last.year, id: last.id } : null }, { headers })
    } catch (error) {
      const failure = error instanceof FormError ? error : new FormError('UNAVAILABLE', 503)
      if (failure.status >= 500) log(serviceFailureLog(error))
      return Response.json({ error: failure.code }, { status: failure.status, headers })
    }
  }
}
