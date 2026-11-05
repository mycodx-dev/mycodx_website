import { getConfig } from '../server/config.ts'
import { createRecruitDatabase } from '../server/supabase.ts'
import { createPublicationsHandler } from '../server/publications.ts'
export default {
  async fetch(request: Request) {
    const config = getConfig()
    return createPublicationsHandler(config, createRecruitDatabase(config), process.env.PUBLICATIONS_CMS_ENABLED === 'true')(request)
  },
}
