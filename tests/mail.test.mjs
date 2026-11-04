import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import nodemailer from 'nodemailer'
import { getConfig } from '../server/config.ts'
import { buildMail, sendSubmission } from '../server/mail.ts'

const commonEnv = {
  MAIL_FORMS_ENABLED: 'true', FORM_ALLOWED_ORIGINS: 'https://website.example.test',
  FORM_SIGNING_SECRET: 'test-only-signing-secret-longer-than-thirty-two-characters',
  CRON_SECRET: 'test-only-cron-secret-longer-than-thirty-two-characters',
  BLOB_READ_WRITE_TOKEN: 'test-only-blob-token',
  CONTACT_TO: 'contact@example.test', CAREERS_TO: 'careers@example.test',
}
const smtpEnv = { ...commonEnv, MAIL_PROVIDER: 'smtp', SMTP_USER: 'sender@example.test', SMTP_PASS: 'test-only-password' }
const resendEnv = { ...commonEnv, MAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_test_only', RESEND_FROM: 'website@send.example.test' }

function submission(kind = 'contact', attachments = []) {
  return {
    id: randomUUID(), kind, language: 'ko', createdAt: Date.UTC(2026, 9, 30),
    fields: { name: '테스트 지원자', email: 'applicant@example.test', message: '가상 테스트입니다.' },
    attachments,
  }
}

test('provider selection is explicit and only the selected credentials enable sending', () => {
  const both = { ...smtpEnv, ...resendEnv }
  for (const MAIL_PROVIDER of [undefined, '', 'automatic', 'SMTP']) {
    assert.equal(getConfig({ ...both, MAIL_PROVIDER }).enabled, false)
  }
  assert.equal(getConfig(smtpEnv).enabled, true)
  assert.equal(getConfig(resendEnv).enabled, true)
  assert.equal(getConfig({ ...smtpEnv, SMTP_PASS: '', ...resendEnv, MAIL_PROVIDER: 'smtp' }).enabled, false)
  assert.equal(getConfig({ ...both, RESEND_API_KEY: '' }).enabled, false)
  assert.equal(getConfig({ ...smtpEnv, RESEND_API_KEY: '', RESEND_FROM: 'invalid' }).enabled, true)
  assert.equal(getConfig({ ...resendEnv, SMTP_HOST: 'invalid host', SMTP_PASS: '' }).enabled, true)
  for (const env of [smtpEnv, resendEnv]) {
    assert.equal(getConfig({ ...env, MAIL_FORMS_ENABLED: 'false' }).enabled, false)
    assert.equal(getConfig({ ...env, VERCEL_ENV: 'preview' }).enabled, false)
    assert.equal(getConfig({ ...env, VERCEL_ENV: 'preview', MAIL_TEST_RECIPIENT: 'tester@example.test' }).enabled, true)
  }
})

test('SMTP uses its login mailbox and TLS ports; the legacy Resend sender remains compatible', () => {
  const smtp = getConfig({ ...smtpEnv, MAIL_FROM: 'legacy@send.example.test', RESEND_FROM: 'other@send.example.test' })
  assert.equal(smtp.mailFrom, 'sender@example.test')
  assert.equal(smtp.smtpHost, 'wsmtp.ecount.com')
  assert.equal(smtp.smtpPort, 587)
  assert.equal(getConfig({ ...smtpEnv, SMTP_PORT: '465' }).enabled, true)
  for (const overrides of [
    { SMTP_PORT: '25' }, { SMTP_PORT: 'invalid' }, { SMTP_HOST: 'https://wsmtp.ecount.com' },
    { SMTP_USER: 'sender@example.test\r\nBcc:other@example.test' }, { SMTP_PASS: 'password\n' },
  ]) assert.equal(getConfig({ ...smtpEnv, ...overrides }).enabled, false)
  assert.equal(getConfig({ ...resendEnv, RESEND_FROM: '', MAIL_FROM: 'legacy@send.example.test' }).mailFrom, 'legacy@send.example.test')
  assert.equal(getConfig({ ...resendEnv, MAIL_FROM: 'legacy@send.example.test' }).mailFrom, 'website@send.example.test')
})

test('SMTP awaits final acceptance and preserves recipients, Reply-To and large attachment bytes over TLS', async () => {
  const bytes = Buffer.alloc(6 * 1024 * 1024, 0x20)
  bytes.write('%PDF-1.7')
  const outgoing = submission('careers', [{ group: 'application', name: '지원서.pdf', contentType: 'application/pdf', content: bytes }])
  for (const port of [587, 465]) {
    for (const testTo of ['', 'tester@example.test']) {
      let closed = 0
      let release
      const accepted = new Promise(resolve => { release = resolve })
      let settled = false
      const target = testTo || 'careers@example.test'
      const config = getConfig({ ...smtpEnv, SMTP_PORT: String(port), MAIL_TEST_RECIPIENT: testTo })
      const pending = sendSubmission(outgoing, config, {
        fetcher: () => assert.fail('SMTP must not call Resend'),
        createSmtpTransport: options => {
          assert.equal(options.host, 'wsmtp.ecount.com')
          assert.equal(options.port, port)
          assert.equal(options.secure, port === 465)
          assert.equal(options.requireTLS, true)
          assert.equal(options.tls.rejectUnauthorized, true)
          assert.equal(options.tls.minVersion, 'TLSv1.2')
          assert.deepEqual(options.auth, { user: smtpEnv.SMTP_USER, pass: smtpEnv.SMTP_PASS })
          assert.equal(options.disableFileAccess, true)
          assert.equal(options.disableUrlAccess, true)
          assert.equal(options.logger, false)
          assert.equal(options.debug, false)
          return {
            async sendMail(mail) {
              assert.equal(mail.from, 'MycoDx 홈페이지 <sender@example.test>')
              assert.deepEqual(mail.to, [target])
              assert.deepEqual(mail.envelope, { from: 'sender@example.test', to: [target] })
              assert.equal(mail.replyTo, 'applicant@example.test')
              assert.equal(mail.subject.startsWith('[TEST]'), Boolean(testTo))
              assert.match(mail.html, /새로운 채용 지원서가 접수되었습니다/)
              assert.deepEqual(mail.attachments[0].content, bytes)
              assert.equal(mail.messageId, `<mycodx-form.${outgoing.id}@example.test>`)
              await accepted
              return { messageId: mail.messageId, response: '250 2.0.0 queued', accepted: [target], rejected: [] }
            },
            close() { closed++ },
          }
        },
      }).then(receipt => { settled = true; return receipt })
      await Promise.resolve()
      assert.equal(settled, false)
      assert.equal(closed, 0)
      release()
      assert.deepEqual(await pending, { messageId: `<mycodx-form.${outgoing.id}@example.test>` })
      assert.equal(closed, 1)
    }
  }
})

test('SMTP rejection or uncertain completion closes the transport without trying Resend', async () => {
  const good = { messageId: '<test@example.test>', response: '250 queued', accepted: ['contact@example.test'], rejected: [] }
  for (const result of [
    { ...good, rejected: ['contact@example.test'] }, { ...good, accepted: [] },
    { ...good, accepted: ['other@example.test'] }, { ...good, response: '550 refused' },
    { ...good, messageId: '' }, new Error('Connection lost after DATA'),
  ]) {
    let smtpCalls = 0
    let resendCalls = 0
    let closed = 0
    await assert.rejects(sendSubmission(submission(), getConfig(smtpEnv), {
      fetcher: async () => { resendCalls++; return Response.json({ id: 'unexpected' }) },
      createSmtpTransport: () => ({
        async sendMail() { smtpCalls++; if (result instanceof Error) throw result; return result },
        close() { closed++ },
      }),
    }))
    assert.equal(smtpCalls, 1)
    assert.equal(resendCalls, 0)
    assert.equal(closed, 1)
  }
})

test('Resend failure never falls back to SMTP, and a disabled form calls neither provider', async () => {
  let smtpCalls = 0
  let resendCalls = 0
  const dependencies = {
    fetcher: async () => { resendCalls++; throw new Error('Response lost') },
    createSmtpTransport: () => { smtpCalls++; throw new Error('Must not be called') },
  }
  await assert.rejects(sendSubmission(submission(), getConfig(resendEnv), dependencies))
  assert.equal(resendCalls, 1)
  assert.equal(smtpCalls, 0)
  for (const config of [getConfig({ ...smtpEnv, MAIL_FORMS_ENABLED: 'false' }), getConfig({ ...smtpEnv, MAIL_PROVIDER: '' })]) {
    await assert.rejects(sendSubmission(submission(), config, dependencies), /disabled/)
  }
  assert.equal(resendCalls, 1)
  assert.equal(smtpCalls, 0)
})

test('Nodemailer composes a real MIME message locally with a PDF and fixed delivery envelope', async () => {
  const bytes = Buffer.from('%PDF-1.7\nTest attachment\n%%EOF')
  const outgoing = submission('careers', [{ group: 'application', name: '지원서.pdf', contentType: 'application/pdf', content: bytes }])
  const mail = buildMail(outgoing, getConfig(smtpEnv))
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'windows' })
  try {
    const result = await transport.sendMail(mail)
    assert.deepEqual(result.envelope, { from: 'sender@example.test', to: ['careers@example.test'] })
    assert.equal(result.messageId, mail.messageId)
    const mime = result.message.toString('utf8')
    assert.match(mime, /Reply-To: applicant@example\.test/)
    assert.match(mime, /Content-Type: multipart\/mixed/)
    assert.match(mime, /Content-Type: multipart\/alternative/)
    assert.match(mime, /Content-Type: text\/html/)
    assert.match(mime, /Content-Type: text\/plain/)
    assert.match(mime, /Content-Type: application\/pdf/)
    assert.ok(mime.includes(bytes.toString('base64')))
    assert.equal(mime.includes(smtpEnv.SMTP_PASS), false)
  } finally {
    transport.close()
  }
})

test('business mail has structured escaped HTML and readable plain text without visible tracking identifiers', () => {
  const outgoing = submission('careers', [{ group: 'application', name: '지원서<&>.pdf', contentType: 'application/pdf', content: Buffer.from('%PDF-test') }])
  outgoing.fields = { name: '<img src=x onerror=alert(1)>', email: 'applicant@example.test', phone: '010-1234-5678',
    area: '연구개발', education: '석사', experience: '경력', message: '첫 문단\n<script>alert(1)</script>\n둘째 문단', privateField: 'DO_NOT_SHOW' }
  const mail = buildMail(outgoing, getConfig(smtpEnv))
  assert.equal(mail.subject, '[MycoDx 채용] <img src=x onerror=alert(1)> · 연구개발')
  assert.ok(mail.html.includes('&lt;img src=x onerror=alert(1)&gt;'))
  assert.ok(mail.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'))
  assert.ok(mail.html.includes('지원서&lt;&amp;&gt;.pdf'))
  assert.ok(!mail.html.includes('<script>'))
  assert.ok(!mail.html.includes('<img '))
  for (const part of [mail.text, mail.html]) {
    assert.ok(!part.includes(outgoing.id))
    assert.ok(!part.includes('접수번호'))
    assert.ok(!part.includes('DO_NOT_SHOW'))
    assert.ok(part.includes('한국 시간'))
    assert.ok(part.includes('09:00'))
    assert.ok(part.includes('개인정보 수집·이용 동의'))
  }
  assert.ok(mail.text.includes(outgoing.fields.message))
  assert.equal(mail.headers['X-Entity-Ref-ID'], outgoing.id)
  assert.equal(mail.replyTo, outgoing.fields.email)
})

test('live recipient defaults route inquiries and applications separately; override stays explicit', async () => {
  const liveEnv = { ...smtpEnv, CONTACT_TO: '', CAREERS_TO: '' }
  for (const [kind, target] of [['contact','info@mycodx.com'],['careers','jakim@mycodx.com']]) {
    const outgoing = submission(kind)
    const live = buildMail(outgoing,getConfig(liveEnv))
    assert.deepEqual(live.to,[target])
    assert.deepEqual(live.envelope.to,[target])
    assert.ok(!live.subject.startsWith('[TEST]'))
    assert.ok(!live.html.includes('테스트 알림입니다'))
    const testMail = buildMail(outgoing,getConfig({...liveEnv,MAIL_TEST_RECIPIENT:'tester@example.test'}))
    assert.deepEqual(testMail.to,['tester@example.test'])
    assert.ok(testMail.html.includes('테스트 알림입니다'))
    assert.ok(testMail.text.includes(target))
  }
  const outgoing = submission('contact')
  outgoing.fields.inquiryType='연구 협력'
  outgoing.fields.organization='가상 기관'
  const config=getConfig(resendEnv), expected=buildMail(outgoing,config)
  await sendSubmission(outgoing,config,{fetcher:async(_url,options)=>{
    const body=JSON.parse(options.body)
    assert.equal(body.html,expected.html)
    assert.equal(body.text,expected.text)
    assert.equal(body.subject,'[MycoDx 문의] 테스트 지원자 · 연구 협력')
    assert.ok(body.html.includes('가상 기관'))
    return Response.json({id:'mock-receipt'})
  }})
})
