import type { FormsConfig } from './config.ts'
import type { RecruitDatabase } from './supabase.ts'
import type { NewsContent } from '../shared/news.ts'
import { NEWS_SLUG } from './newsValidation.ts'
import { FormError } from './validation.ts'
import { serviceFailureLog } from './serviceDiagnostics.ts'

export function createNewsHandler(config: FormsConfig, database: RecruitDatabase, enabled: boolean, log = console.error) {
  return async (request: Request) => {
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
    try {
      if (request.method !== 'GET') return new Response(null, { status:405,headers:{ ...headers,Allow:'GET' } })
      if (!enabled) return Response.json({ enabled:false,items:[],nextCursor:null },{headers})
      if (!config.supabaseUrl || !config.supabaseSecretKey) throw new FormError('UNAVAILABLE',503)
      const params = new URL(request.url).searchParams
      const slug = params.get('slug'), beforeDate = params.get('beforeDate'), beforeSlug = params.get('beforeSlug')
      if ((slug !== null && (slug.length>100 || !NEWS_SLUG.test(slug))) ||
        ((beforeDate === null) !== (beforeSlug === null)) ||
        (beforeDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(beforeDate)) ||
        (beforeSlug !== null && (beforeSlug.length>100 || !NEWS_SLUG.test(beforeSlug)))) throw new FormError('INVALID_FIELDS')
      const rows = await database.rpc<NewsContent[]>('news_public_list', { p_slug:slug,p_before_date:beforeDate,p_before_slug:beforeSlug })
      const items = rows.slice(0,20), last = items.at(-1)
      return Response.json({ enabled:true,items,nextCursor:rows.length>20 && last ? { date:last.date,slug:last.id } : null },{headers})
    } catch (error) {
      const failure = error instanceof FormError ? error : new FormError('UNAVAILABLE',503)
      if (failure.status>=500) log(serviceFailureLog(error))
      return Response.json({ error:failure.code },{status:failure.status,headers})
    }
  }
}
