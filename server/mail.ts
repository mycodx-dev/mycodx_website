import type { FormsConfig } from './config.ts'
import type { FormKind, FileGroup } from '../shared/forms.ts'
import { sendWithResend } from './mail/resend.ts'
import { sendWithSmtp } from './mail/smtp.ts'
import type { SmtpTransportFactory } from './mail/smtp.ts'
import { renderSubmissionMail } from './mail/template.ts'

export interface OutgoingSubmission {
  id: string
  kind: FormKind
  language: string
  fields: Record<string, string>
  createdAt: number
  attachments: { group: FileGroup; name: string; contentType: string; content: Uint8Array }[]
}

const groups: Record<FileGroup, string> = {
  application: '입사지원서', degree: '학위증명서', transcript: '성적증명서', papers: '기타자료',
}

export function buildMail(submission: OutgoingSubmission, config: FormsConfig) {
  const { fields, id, kind } = submission
  const target = kind === 'careers' ? config.careersTo : config.contactTo
  const attachments = submission.attachments.map((file, index) => ({
    filename: `${index + 1}_${groups[file.group]}_${file.name}`,
    content: Buffer.from(file.content),
    contentType: file.contentType,
  }))
  const content = renderSubmissionMail({ kind, fields, createdAt: submission.createdAt, testTo: config.testTo, target,
    files: submission.attachments.map((file, index) => ({ name: attachments[index].filename, group: groups[file.group], size: file.content.byteLength })),
  })
  return {
    from: `MycoDx 홈페이지 <${config.mailFrom}>`,
    to: [config.testTo || target],
    replyTo: fields.email,
    envelope: { from: config.mailFrom, to: [config.testTo || target] },
    messageId: `<mycodx-form.${id}@${config.mailFrom.split('@')[1]}>`,
    date: new Date(submission.createdAt),
    ...content,
    headers: { 'X-Entity-Ref-ID': id },
    attachments,
    disableFileAccess: true,
    disableUrlAccess: true,
  }
}

export type SubmissionMail = ReturnType<typeof buildMail>

interface MailDependencies {
  fetcher?: typeof fetch
  createSmtpTransport?: SmtpTransportFactory
}

export async function sendSubmission(submission: OutgoingSubmission, config: FormsConfig, dependencies: MailDependencies = {}) {
  if (!config.enabled) throw new Error('Mail sending is disabled')
  const mail = buildMail(submission, config)
  // One explicitly selected provider only. An ambiguous failure must never
  // fall back to another provider and create a second delivery.
  if (config.mailProvider === 'smtp') return sendWithSmtp(mail, config, dependencies.createSmtpTransport)
  if (config.mailProvider === 'resend') return sendWithResend(submission.id, mail, config, dependencies.fetcher)
  throw new Error('Mail provider is not selected')
}
