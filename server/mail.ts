import type { FormsConfig } from './config.ts'
import type { FormKind, FileGroup } from '../shared/forms.ts'
import { sendWithResend } from './mail/resend.ts'
import { sendWithSmtp } from './mail/smtp.ts'
import type { SmtpTransportFactory } from './mail/smtp.ts'

export interface OutgoingSubmission {
  id: string
  kind: FormKind
  language: string
  fields: Record<string, string>
  createdAt: number
  attachments: { group: FileGroup; name: string; contentType: string; content: Uint8Array }[]
}

const labels: Record<string, string> = {
  name: '성명', email: '회신 이메일', message: '내용', inquiryType: '문의 유형',
  organization: '소속', area: '지원 분야', phone: '연락처', education: '최종 학력', experience: '경력 구분',
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
  return {
    from: `MycoDx 홈페이지 <${config.mailFrom}>`,
    to: [config.testTo || target],
    replyTo: fields.email,
    envelope: { from: config.mailFrom, to: [config.testTo || target] },
    messageId: `<mycodx-form.${id}@${config.mailFrom.split('@')[1]}>`,
    date: new Date(submission.createdAt),
    subject: `${config.testTo ? '[TEST] ' : ''}[MycoDx ${kind === 'careers' ? '채용' : '문의'}] ${fields.name} (${id.slice(0, 8)})`,
    headers: { 'X-Entity-Ref-ID': id },
    text: [
      `접수번호: ${id}`,
      `제출 시각: ${new Date(submission.createdAt).toISOString()}`,
      `언어: ${submission.language}`,
      ...(config.testTo ? [`테스트 모드 — 실제 수신 대상: ${target}`] : []),
      '', ...Object.entries(fields).map(([key, value]) => `${labels[key] ?? key}: ${value || '-'}`),
      '', '개인정보 수집·이용 동의: 동의함',
      `첨부파일: ${attachments.length}개`, ...attachments.map(file => `- ${file.filename}`),
      '', '이 메일에 답장하면 제출자가 입력한 회신 이메일로 발송됩니다.',
    ].join('\n'),
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
