import { FILE_GROUPS, MAX_FILES, MAX_TOTAL_FILE_SIZE, fileAllowed } from '../shared/forms.ts'
import type { FileInfo, SubmissionInput } from '../shared/forms.ts'

export class FormError extends Error {
  status: number
  code: string
  constructor(code: string, status = 400) {
    super(code)
    this.code = code
    this.status = status
  }
}

export const EMAIL_PATTERN = /^[^\s<>(),;:"\\@]+@[^\s<>(),;:"\\@]+\.[^\s<>(),;:"\\@]+$/

function text(value: unknown, max: number, required = true, multiline = false) {
  if (typeof value !== 'string') throw new FormError('INVALID_FIELDS')
  const clean = value.trim().normalize('NFC')
  const hasControls = Array.from(clean).some(character => {
    const code = character.charCodeAt(0)
    return code === 127 || (code < 32 && ![9, 10, 13].includes(code))
  })
  if ((required && !clean) || clean.length > max || hasControls) {
    throw new FormError('INVALID_FIELDS')
  }
  if (!multiline && /[\r\n]/.test(clean)) throw new FormError('INVALID_FIELDS')
  return clean
}

export function validateSubmission(value: unknown, now = Date.now()): SubmissionInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new FormError('INVALID_FIELDS')
  const input = value as Record<string, unknown>
  if (input.kind !== 'contact' && input.kind !== 'careers') throw new FormError('INVALID_FIELDS')
  if (input.consent !== true) throw new FormError('CONSENT_REQUIRED')
  if (input.website !== '' || typeof input.startedAt !== 'number' ||
      now - input.startedAt < 2000 || now - input.startedAt > 24 * 60 * 60 * 1000) {
    throw new FormError('INVALID_SUBMISSION')
  }
  if (!input.fields || typeof input.fields !== 'object' || Array.isArray(input.fields)) throw new FormError('INVALID_FIELDS')
  const source = input.fields as Record<string, unknown>
  const fields: Record<string, string> = {
    name: text(source.name, 100),
    email: text(source.email, 254),
    message: text(source.message, input.kind === 'careers' ? 1000 : 5000, input.kind === 'contact', true),
  }
  if (!EMAIL_PATTERN.test(fields.email)) throw new FormError('INVALID_FIELDS')
  if (input.kind === 'contact') {
    fields.inquiryType = text(source.inquiryType, 100)
    fields.organization = text(source.organization, 200, false)
  } else {
    fields.area = text(source.area, 100)
    fields.phone = text(source.phone, 40)
    fields.education = text(source.education, 100)
    fields.experience = text(source.experience, 100)
  }

  if (!Array.isArray(input.files) || input.files.length > MAX_FILES) throw new FormError('FILE_COUNT')
  const files: FileInfo[] = input.files.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new FormError('FILE_TYPE')
    const file = item as FileInfo
    if (!FILE_GROUPS.includes(file.group)) throw new FormError('FILE_TYPE')
    const name = text(file.name, 180)
    if (/[\\/]/.test(name) || name.startsWith('.')) throw new FormError('FILE_TYPE')
    if (!Number.isSafeInteger(file.size) || file.size <= 0) throw new FormError('FILE_SIZE')
    const clean = { group: file.group, name, size: file.size }
    if (!fileAllowed(clean)) throw new FormError('FILE_TYPE')
    return clean
  })
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_FILE_SIZE) throw new FormError('FILE_SIZE')
  if (input.kind === 'contact' && files.length) throw new FormError('FILE_TYPE')
  if (input.kind === 'careers' && (
    files.filter(file => file.group === 'application').length !== 1 ||
    !files.some(file => file.group === 'degree') || !files.some(file => file.group === 'transcript')
  )) throw new FormError('FILES_REQUIRED')

  return {
    kind: input.kind, fields, files, consent: true, website: '', startedAt: input.startedAt,
    language: ['ko', 'en', 'ja', 'fr'].includes(String(input.language)) ? String(input.language) : 'ko',
  }
}

export function verifyFileBytes(name: string, bytes: Uint8Array) {
  const extension = name.split('.').pop()?.toLowerCase()
  const signatures: Record<string, number[][]> = {
    pdf: [[0x25, 0x50, 0x44, 0x46, 0x2d]],
    doc: [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
    docx: [[0x50, 0x4b, 0x03, 0x04]],
    zip: [[0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06]],
  }
  if (!signatures[extension ?? '']?.some(signature => signature.every((byte, index) => bytes[index] === byte))) {
    throw new FormError('FILE_TYPE')
  }
}

export async function readJson(request: Request, maxBytes = 24 * 1024): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new FormError('INVALID_FIELDS', 415)
  if (Number(request.headers.get('content-length')) > maxBytes) throw new FormError('REQUEST_TOO_LARGE', 413)
  if (!request.body) throw new FormError('INVALID_FIELDS')
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel()
        throw new FormError('REQUEST_TOO_LARGE', 413)
      }
      chunks.push(value)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch (error) {
    if (error instanceof FormError) throw error
    throw new FormError('INVALID_FIELDS')
  } finally {
    reader.releaseLock()
  }
}
