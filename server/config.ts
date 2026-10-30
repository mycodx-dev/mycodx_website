import { EMAIL_PATTERN, FormError } from './validation.ts'

export function getConfig(env: NodeJS.ProcessEnv = process.env) {
  const from = env.MAIL_FROM?.trim() ?? ''
  const resendApiKey = env.RESEND_API_KEY?.trim() ?? ''
  const signingSecret = env.FORM_SIGNING_SECRET ?? ''
  const origins = (env.FORM_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean)
  if (env.VERCEL_URL) origins.push(`https://${env.VERCEL_URL}`)
  const contactTo = env.CONTACT_TO?.trim() || 'info@mycodx.com'
  const careersTo = env.CAREERS_TO?.trim() || 'jakim@mycodx.com'
  const testTo = env.MAIL_TEST_RECIPIENT?.trim() || ''
  const configured = Boolean(
    env.BLOB_READ_WRITE_TOKEN && signingSecret.length >= 32 && (env.CRON_SECRET?.length ?? 0) >= 32 &&
    resendApiKey && !/\s/.test(resendApiKey) && origins.length &&
    (env.VERCEL_ENV !== 'preview' || testTo) &&
    [from, contactTo, careersTo, ...(testTo ? [testTo] : [])].every(email => EMAIL_PATTERN.test(email)),
  )
  return {
    enabled: env.MAIL_FORMS_ENABLED === 'true' && configured,
    blobToken: env.BLOB_READ_WRITE_TOKEN ?? '', signingSecret, origins,
    resendApiKey, mailFrom: from,
    contactTo, careersTo, testTo,
    cronSecret: env.CRON_SECRET ?? '',
  }
}
export type FormsConfig = ReturnType<typeof getConfig>

export function checkOrigin(request: Request, config: FormsConfig) {
  const origin = request.headers.get('origin')
  if (!origin || !config.origins.includes(origin)) throw new FormError('FORBIDDEN', 403)
  if (request.headers.get('sec-fetch-site') === 'cross-site') throw new FormError('FORBIDDEN', 403)
}
