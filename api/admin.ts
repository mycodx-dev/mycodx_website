import { getAdminConfig } from '../server/adminConfig.ts'
import { createAdminGateway } from '../server/adminGateway.ts'
import { createAdminHandler } from '../server/admin.ts'
import { createRecruitDatabase } from '../server/supabase.ts'
import { createBlobStore } from '../server/storage.ts'

export default {
  async fetch(request: Request) {
    const config = getAdminConfig()
    return createAdminHandler({ config, gateway: createAdminGateway(config),
      database: createRecruitDatabase(config), store: createBlobStore(config.blobToken) })(request)
  },
}
