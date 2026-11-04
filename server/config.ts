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
  const signingSecret = env.FORM_SIGNING_SECRET ?? ''
  const origins = (env.FORM_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean)
  if (env.VERCEL_URL) origins.push(`https://${env.VERCEL_URL}`)
  const contactTo = env.CONTACT_TO?.trim() || 'info@mycodx.com'
  const careersTo = env.CAREERS_TO?.trim() || 'jakim@mycodx.com'
  const testTo = env.MAIL_TEST_RECIPIENT?.trim() || ''
  const supabaseUrl = env.SUPABASE_URL?.trim().replace(/\/$/, '') ?? ''
  const supabaseSecretKey = env.SUPABASE_SECRET_KEY?.trim() ?? ''
  // Reasons are fixed labels, never interpolated values. The same checks drive
  // enablement and the server-only diagnostics, so the report cannot drift.
  const commonIssues: string[] = []
  if (!env.BLOB_READ_WRITE_TOKEN) commonIssues.push('BLOB_READ_WRITE_TOKEN: required')
  if (signingSecret.length < 32) commonIssues.push('FORM_SIGNING_SECRET: at least 32 characters required')
  if ((env.CRON_SECRET?.length ?? 0) < 32) commonIssues.push('CRON_SECRET: at least 32 characters required')
  if (!origins.length) commonIssues.push('FORM_ALLOWED_ORIGINS: origin required')
  if (env.VERCEL_ENV === 'preview' && !testTo) commonIssues.push('MAIL_TEST_RECIPIENT: required in Preview')
  if (testTo && !EMAIL_PATTERN.test(testTo)) commonIssues.push('MAIL_TEST_RECIPIENT: invalid email format')
  if (!EMAIL_PATTERN.test(careersTo)) commonIssues.push('CAREERS_TO: invalid email format')

  const mailIssues = [...commonIssues]
  if (env.MAIL_FORMS_ENABLED !== 'true') mailIssues.push('MAIL_FORMS_ENABLED: must be true')
  if (!mailProvider) mailIssues.push('MAIL_PROVIDER: select smtp or resend')
  if (!EMAIL_PATTERN.test(contactTo)) mailIssues.push('CONTACT_TO: invalid email format')
  if (mailProvider === 'smtp') {
    if (!/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/i.test(smtpHost)) mailIssues.push('SMTP_HOST: invalid hostname')
    if (![465, 587].includes(smtpPort)) mailIssues.push('SMTP_PORT: use 465 or 587')
    if (!EMAIL_PATTERN.test(smtpUser)) mailIssues.push('SMTP_USER: mailbox address required')
    if (!smtpPass || /[\r\n\0]/.test(smtpPass)) mailIssues.push('SMTP_PASS: required; remove line breaks')
  }
  if (mailProvider === 'resend') {
    if (!resendApiKey || /\s/.test(resendApiKey)) mailIssues.push('RESEND_API_KEY: required; remove whitespace')
    if (!EMAIL_PATTERN.test(from)) mailIssues.push('RESEND_FROM or MAIL_FROM: sender address required')
  }

  const careersIssues = [...commonIssues]
  if (env.RECRUIT_FORMS_ENABLED !== 'true') careersIssues.push('RECRUIT_FORMS_ENABLED: must be true')
  // Only the project's HTTPS API endpoint may receive the server secret.
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabaseUrl)) careersIssues.push('SUPABASE_URL: project HTTPS URL required')
  if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(supabaseSecretKey)) careersIssues.push('SUPABASE_SECRET_KEY: modern secret key required')
  return {
    enabled: mailIssues.length === 0,
    recruitEnabled: careersIssues.length === 0,
    diagnostics: { mailIssues, careersIssues },
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
