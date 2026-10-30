import { EMAIL_PATTERN, FormError } from './validation.ts'

export type MailProvider = 'smtp' | 'resend'

export function getConfig(env: NodeJS.ProcessEnv = process.env) {
  const selection = env.MAIL_PROVIDER?.trim()
  const mailProvider: MailProvider | undefined = selection === 'smtp' || selection === 'resend' ? selection : undefined
  const smtpHost = env.SMTP_HOST?.trim() || 'wsmtp.ecount.com'
  const smtpPort = Number(env.SMTP_PORT?.trim() || '587')
  const smtpUser = env.SMTP_USER?.trim() ?? ''
  const smtpPass = env.SMTP_PASS ?? ''
  // MAIL_FROM remains a fallback for the existing Resend environment only.
  // SMTP always sends as the authenticated mailbox, independently of Resend's sender.
  const from = mailProvider === 'smtp' ? smtpUser : (env.RESEND_FROM?.trim() || env.MAIL_FROM?.trim() || '')
  const resendApiKey = env.RESEND_API_KEY?.trim() ?? ''
  const smtpConfigured = Boolean(
    /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/i.test(smtpHost) &&
    [465, 587].includes(smtpPort) && EMAIL_PATTERN.test(smtpUser) &&
    smtpPass.length && !/[\r\n\0]/.test(smtpPass),
  )
  const providerConfigured = mailProvider === 'smtp' ? smtpConfigured
    : mailProvider === 'resend' ? Boolean(resendApiKey && !/\s/.test(resendApiKey)) : false
  const signingSecret = env.FORM_SIGNING_SECRET ?? ''
  const origins = (env.FORM_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean)
  if (env.VERCEL_URL) origins.push(`https://${env.VERCEL_URL}`)
  const contactTo = env.CONTACT_TO?.trim() || 'info@mycodx.com'
  const careersTo = env.CAREERS_TO?.trim() || 'jakim@mycodx.com'
  const testTo = env.MAIL_TEST_RECIPIENT?.trim() || ''
  const supabaseUrl = env.SUPABASE_URL?.trim().replace(/\/$/, '') ?? ''
  const supabaseSecretKey = env.SUPABASE_SECRET_KEY?.trim() ?? ''
  // Only the project's HTTPS API endpoint may receive the server secret.
  const recruitConfigured = Boolean(
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabaseUrl) &&
    /^sb_secret_[A-Za-z0-9_-]+$/.test(supabaseSecretKey) &&
    env.BLOB_READ_WRITE_TOKEN && signingSecret.length >= 32 && (env.CRON_SECRET?.length ?? 0) >= 32 &&
    origins.length && (env.VERCEL_ENV !== 'preview' || testTo) &&
    [careersTo, ...(testTo ? [testTo] : [])].every(email => EMAIL_PATTERN.test(email)),
  )
  const configured = Boolean(
    env.BLOB_READ_WRITE_TOKEN && signingSecret.length >= 32 && (env.CRON_SECRET?.length ?? 0) >= 32 &&
    providerConfigured && origins.length &&
    (env.VERCEL_ENV !== 'preview' || testTo) &&
    [from, contactTo, careersTo, ...(testTo ? [testTo] : [])].every(email => EMAIL_PATTERN.test(email)),
  )
  return {
    enabled: env.MAIL_FORMS_ENABLED === 'true' && configured,
    recruitEnabled: env.RECRUIT_FORMS_ENABLED === 'true' && recruitConfigured,
    supabaseUrl, supabaseSecretKey,
    blobToken: env.BLOB_READ_WRITE_TOKEN ?? '', signingSecret, origins,
    mailProvider, resendApiKey, mailFrom: from,
    smtpHost, smtpPort, smtpUser, smtpPass,
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
