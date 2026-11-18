import type { AdminApplicationDetail } from '../../shared/admin'
import { adminRequest, AdminError } from './admin.ts'

type ApplicationFile = AdminApplicationDetail['files'][number]

export const adminFileGroups: Record<string, string> = {
  application: '입사지원서', degree: '학위 증명', transcript: '성적 증명', papers: '논문 및 기타',
}

function cleanFilename(value: string) {
  return value.normalize('NFC').replace(/[<>:"/\\|?*\p{Cc}\p{Cf}]/gu, '_')
    .replace(/\s+/g, ' ').trim().replace(/[. ]+$/u, '')
}

function truncateFilename(value: string, maxBytes: number) {
  const encoder = new TextEncoder()
  let result = '', bytes = 0
  for (const character of value) {
    bytes += encoder.encode(character).length
    if (bytes > maxBytes) break
    result += character
  }
  return result
}

export function applicationDownloadFilename(applicantName: string, file: Pick<ApplicationFile, 'name' | 'group'>) {
  const applicant = truncateFilename(cleanFilename(applicantName) || '지원자', 90)
  const group = adminFileGroups[file.group] || '첨부파일'
  const original = cleanFilename(file.name) || '첨부파일'
  const extension = original.match(/\.(?:pdf|docx?|zip)$/i)?.[0] || ''
  const stem = extension ? original.slice(0, -extension.length) : original
  const prefix = `${applicant}_${group}_`
  // Stay below common filesystem limits in UTF-8 bytes, preserving the extension.
  const available = 240 - new TextEncoder().encode(prefix + extension).length
  return `${prefix}${truncateFilename(stem, available)}${extension}`
}

export async function downloadApplicationFile(applicantName: string, file: ApplicationFile, signal: AbortSignal) {
  const { url } = await adminRequest<{ url: string }>('download', { fileId: file.id }, signal)
  signal.throwIfAborted()
  let blob: Blob
  try {
    const response = await fetch(url, {
      credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]),
    })
    if (!response.ok) throw new Error('DOWNLOAD_FAILED')
    blob = await response.blob()
  } catch {
    signal.throwIfAborted()
    throw new AdminError('DOWNLOAD_FAILED', 503)
  }
  signal.throwIfAborted()

  // A local blob URL lets the browser honor the filename across storage origins,
  // without adding applicant details to the signed storage URL or request body.
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  try {
    link.href = objectUrl
    link.download = applicationDownloadFilename(applicantName, file)
    link.hidden = true
    document.body.appendChild(link)
    link.click()
  } finally {
    link.remove()
    // Give the browser time to start saving before releasing the object URL.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  }
}
