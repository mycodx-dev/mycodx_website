import { timingSafeEqual } from 'node:crypto'
import { getConfig } from '../server/config.ts'
import { createBlobStore, cleanupBlobs } from '../server/storage.ts'
import { sendSubmission } from '../server/mail.ts'
import { createFormsHandler } from '../server/forms.ts'
import { createRecruitDatabase } from '../server/supabase.ts'
import { createRecruitmentService } from '../server/recruitment.ts'

export default {
  async fetch(request: Request) {
    const config = getConfig()
    if (new URL(request.url).searchParams.get('action') === 'cleanup') {
      const expected = Buffer.from(`Bearer ${config.cronSecret}`)
      const actual = Buffer.from(request.headers.get('authorization') ?? '')
      if (request.method !== 'GET' || config.cronSecret.length < 32 || actual.length !== expected.length ||
          !timingSafeEqual(actual, expected)) {
        return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
      }
      if (!config.blobToken) return Response.json({ error: 'UNAVAILABLE' }, { status: 503 })
      try {
        const result = await cleanupBlobs(config.blobToken)
        return Response.json(result, { status: result.complete ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
      } catch {
        console.error(JSON.stringify({ event: 'forms_cleanup_error' }))
        return Response.json({ error: 'UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
      }
    }
    const dependencies = {
      config, store: createBlobStore(config.blobToken),
      sendMail: (submission: Parameters<typeof sendSubmission>[0]) => sendSubmission(submission, config),
    }
    const handler = createFormsHandler({ ...dependencies, recruitment: config.recruitEnabled
      ? createRecruitmentService({ ...dependencies, database: createRecruitDatabase(config) }) : undefined })
    return handler(request)
  },
}
