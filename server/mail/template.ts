import type { FormKind } from '../../shared/forms.ts'

interface MailContent {
  kind: FormKind
  fields: Record<string, string>
  createdAt: number
  testTo: string
  target: string
  files: { name: string; group: string; size: number }[]
}
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]!))
const headerText = (value: string) => value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 100)
const fileSize = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.ceil(bytes / 1024))} KB`

export function renderSubmissionMail({ kind, fields, createdAt, testTo, target, files }: MailContent) {
  const careers = kind === 'careers'
  const category = careers ? '채용' : '문의'
  const title = careers ? '새로운 채용 지원서가 접수되었습니다.' : '새로운 문의가 도착했습니다.'
  const lead = careers ? '지원자 정보와 제출 서류를 확인해 주세요.' : '문의 내용을 확인하고 작성자에게 회신해 주세요.'
  const submittedAt = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(createdAt)) + ' (한국 시간)'
  const fieldsToShow = careers
    ? [['지원 분야', fields.area], ['성명', fields.name], ['이메일', fields.email], ['연락처', fields.phone], ['최종 학력', fields.education], ['경력 구분', fields.experience]]
    : [['문의 유형', fields.inquiryType], ['성명', fields.name], ['소속', fields.organization], ['이메일', fields.email]]
  const rows = [...fieldsToShow, ['접수 시각', submittedAt]].map(([label, value]) => [label, value || '미기재'])
  const messageTitle = careers ? '주요 경력 및 지원 내용' : '문의 내용'
  const message = fields.message || '작성된 내용이 없습니다.'
  const replyNote = '이 메일에 답장하면 작성자가 입력한 이메일로 회신됩니다.'
  const testNote = testTo ? `테스트 알림입니다. 운영 수신처(${target}) 대신 테스트 수신함으로 전달되었습니다.` : ''
  const subject = `${testTo ? '[TEST] ' : ''}[MycoDx ${category}] ${headerText(fields.name || '새 접수')}${(careers ? fields.area : fields.inquiryType) ? ` · ${headerText(careers ? fields.area : fields.inquiryType)}` : ''}`
  const text = [
    title, lead, ...(testNote ? ['', testNote] : []), '',
    ...rows.map(([label, value]) => `${label}: ${value}`), '', messageTitle, message,
    ...(careers ? ['', `첨부 서류 (${files.length}개)`, ...(files.length
      ? files.map(file => `- ${file.group} | ${file.name} | ${fileSize(file.size)}`) : ['첨부 서류 없음'])] : []),
    '', '개인정보 수집·이용 동의: 동의함', '', replyNote,
    ...(careers ? ['지원서 검토와 확인 상태 관리는 관리자 페이지에서 진행해 주세요.'] : []),
    'MycoDx 홈페이지 알림',
  ].join('\n')
  const rowHtml = rows.map(([label, value]) => `<tr><th scope="row" style="width:108px;padding:12px 14px;border-bottom:1px solid #e8ebee;background:#f7f8fa;text-align:left;vertical-align:top;font-size:13px;font-weight:600;color:#596579;">${escapeHtml(label)}</th><td style="padding:12px 14px;border-bottom:1px solid #e8ebee;vertical-align:top;font-size:14px;color:#233143;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(value)}</td></tr>`).join('')
  const fileHtml = careers ? `<h2 style="font-size:16px;margin:28px 0 12px;color:#233143;">첨부 서류 <span style="color:#a72c3a;">${files.length}개</span></h2>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e6e9;border-collapse:collapse;table-layout:fixed;">${files.map(file => `<tr><td style="padding:12px 14px;border-bottom:1px solid #e8ebee;word-break:break-word;overflow-wrap:anywhere;"><span style="font-size:12px;color:#697586;">${escapeHtml(file.group)} · ${fileSize(file.size)}</span><br><span style="font-size:14px;color:#233143;">${escapeHtml(file.name)}</span></td></tr>`).join('') || '<tr><td style="padding:14px;">첨부 서류 없음</td></tr>'}</table>` : ''
  // Table layout and inline styles work without remote assets or CSS support.
  // All applicant-controlled content stays escaped text, never raw HTML or URLs.
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,'Malgun Gothic',sans-serif;line-height:1.6;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(`${category} · ${fields.name} · ${lead}`)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fff;border:1px solid #e2e6e9;border-collapse:collapse;table-layout:fixed;">
<tr><td style="padding:22px 24px;border-top:4px solid #a72c3a;border-bottom:1px solid #e8ebee;"><span style="font-size:24px;font-weight:700;color:#233143;">MycoDx</span><span style="font-size:13px;color:#697586;"> &nbsp;|&nbsp; ${category} 알림</span></td></tr>
<tr><td style="padding:26px 24px;">
${testNote ? `<div style="padding:12px 14px;margin-bottom:22px;background:#fff6df;color:#795919;font-size:13px;">${escapeHtml(testNote)}</div>` : ''}
<h1 style="margin:0 0 8px;font-size:22px;line-height:1.4;color:#233143;">${title}</h1><p style="margin:0 0 24px;font-size:14px;color:#697586;">${lead}</p>
<table width="100%" cellspacing="0" cellpadding="0" aria-label="${careers ? '지원자' : '문의자'} 정보" style="border:1px solid #e2e6e9;border-collapse:collapse;table-layout:fixed;">${rowHtml}</table>
<h2 style="font-size:16px;margin:28px 0 12px;color:#233143;">${messageTitle}</h2>
<div style="padding:18px;background:#f7f8fa;border:1px solid #e8ebee;font-size:14px;color:#233143;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(message).replace(/\r\n|\r|\n/g, '<br>')}</div>
${fileHtml}<p style="margin:20px 0 0;font-size:12px;color:#697586;">개인정보 수집·이용 동의: 동의함</p>
</td></tr><tr><td style="padding:20px 24px;border-top:1px solid #e8ebee;background:#fafbfc;font-size:13px;color:#596579;">${replyNote}${careers ? '<br>지원서 검토와 확인 상태 관리는 관리자 페이지에서 진행해 주세요.' : ''}<br><span style="font-size:11px;color:#8792a0;">MycoDx 홈페이지 알림</span></td></tr>
</table></td></tr></table></body></html>`
  return { subject, text, html }
}
