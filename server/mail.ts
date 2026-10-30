import type { FormsConfig } from './config.ts'
import type { FormKind, FileGroup } from '../shared/forms.ts'

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
    content: Buffer.from(file.content).toString('base64'),
  }))
  return {
    from: `MycoDx 홈페이지 <${config.mailFrom}>`,
    to: [config.testTo || target],
    reply_to: fields.email,
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
  }
}

export async function sendSubmission(submission: OutgoingSubmission, config: FormsConfig, fetcher: typeof fetch = fetch) {
  const response = await fetcher('https://api.resend.com/emails', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60_000),
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `mycodx-form/${submission.id}`,
    },
    // Send verified bytes only: no user-supplied URLs or local filesystem paths.
    body: JSON.stringify(buildMail(submission, config)),
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error('Mail provider did not accept the request')
  }
  const result = await response.json() as { id?: unknown }
  if (typeof result.id !== 'string' || !result.id) throw new Error('Mail provider receipt missing')
  return { messageId: result.id }
}
