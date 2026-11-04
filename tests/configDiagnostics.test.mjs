import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getConfig } from '../server/config.ts'
import { createConfigurationLogger } from '../server/configDiagnostics.ts'

const env = {
  VERCEL_ENV: 'production', VERCEL_URL: 'website.vercel.app',
  FORM_SIGNING_SECRET: 'test-signing-secret-that-is-longer-than-32-characters',
  CRON_SECRET: 'test-cron-secret-that-is-longer-than-32-characters',
  BLOB_READ_WRITE_TOKEN: 'test-blob-token-secret',
  RECRUIT_FORMS_ENABLED: 'true', SUPABASE_URL: 'https://project-test.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
  MAIL_TEST_RECIPIENT: 'recipient@example.test',
}

test('mail disabled and careers enabled reports the missing switch/provider without changing enablement', () => {
  const config = getConfig(env)
  assert.equal(config.enabled, false)
  assert.equal(config.recruitEnabled, true)
  assert.deepEqual(config.diagnostics.careersIssues, [])
  assert.deepEqual(config.diagnostics.mailIssues, [
    'MAIL_FORMS_ENABLED: must be true', 'MAIL_PROVIDER: select smtp or resend',
  ])
})

test('diagnostics only require credentials for the selected provider', () => {
  const smtp = { ...env, MAIL_FORMS_ENABLED: 'true', MAIL_PROVIDER: 'smtp', SMTP_USER: 'sender@example.test' }
  assert.deepEqual(getConfig(smtp).diagnostics.mailIssues, ['SMTP_PASS: required; remove line breaks'])
  assert.equal(getConfig({ ...smtp, SMTP_PASS: 'test-password' }).enabled, true)
  const resend = { ...env, MAIL_FORMS_ENABLED: 'true', MAIL_PROVIDER: 'resend', RESEND_FROM: 'sender@example.test' }
  assert.deepEqual(getConfig(resend).diagnostics.mailIssues, ['RESEND_API_KEY: required; remove whitespace'])
  assert.equal(getConfig({ ...resend, RESEND_API_KEY: 're_test_only' }).enabled, true)
})

test('invalid fields and shared prerequisites are identified without echoing values', () => {
  const config = getConfig({ ...env, MAIL_FORMS_ENABLED: 'true', MAIL_PROVIDER: 'smtp',
    SMTP_HOST: 'https://invalid.test', SMTP_PORT: '25', SMTP_USER: 'invalid-mailbox', SMTP_PASS: 'private-value\n',
    CRON_SECRET: 'short-private-secret', CONTACT_TO: 'invalid-contact',
  })
  for (const key of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'CRON_SECRET', 'CONTACT_TO']) {
    assert.ok(config.diagnostics.mailIssues.some(issue => issue.startsWith(key + ':')))
  }
  assert.equal(config.recruitEnabled, false)
  assert.deepEqual(config.diagnostics.careersIssues, ['CRON_SECRET: at least 32 characters required'])
  for (const value of ['https://invalid.test', 'invalid-mailbox', 'private-value', 'short-private-secret', 'invalid-contact']) {
    assert.equal(JSON.stringify(config.diagnostics).includes(value), false)
  }
})

test('server diagnostics exclude secrets and addresses and suppress repeated identical reports', () => {
  const messages = []
  const log = createConfigurationLogger(message => messages.push(message))
  const config = getConfig({ ...env, MAIL_FORMS_ENABLED: 'true', MAIL_PROVIDER: 'smtp',
    SMTP_USER: 'sender@example.test', SMTP_PASS: 'test-smtp-password', RESEND_API_KEY: 're_hidden_test_secret',
  })
  log(config)
  log(config)
  assert.equal(messages.length, 1)
  for (const value of [config.smtpPass, config.supabaseSecretKey, config.blobToken, config.signingSecret,
    config.cronSecret, config.resendApiKey, config.mailFrom, config.testTo, config.supabaseUrl]) {
    assert.equal(messages[0].includes(value), false)
  }
  assert.deepEqual(JSON.parse(messages[0]), {
    event: 'forms_configuration', enabled: true, careersEnabled: true, mailProvider: 'smtp',
    testRecipientConfigured: true, mailIssues: [], careersIssues: [],
  })
  log(getConfig({ ...env, MAIL_PROVIDER: 'untrusted-value' }))
  assert.equal(messages.length, 2)
  assert.equal(messages[1].includes('untrusted-value'), false)
})
