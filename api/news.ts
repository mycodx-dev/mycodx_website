import { getConfig } from '../server/config.ts'
import { createRecruitDatabase } from '../server/supabase.ts'
import { createNewsHandler } from '../server/news.ts'
export default {
  async fetch(request: Request) {
    const config = getConfig()
    return createNewsHandler(config,createRecruitDatabase(config),process.env.NEWS_CMS_ENABLED==='true')(request)
  },
}
