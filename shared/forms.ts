export const MAX_TOTAL_FILE_SIZE = 10 * 1024 * 1024
export const MAX_FILES = 10
export const FORM_API = '/api/forms'
export const FILE_GROUPS = ['application', 'degree', 'transcript', 'papers'] as const
export type FileGroup = typeof FILE_GROUPS[number]
export type FormKind = 'contact' | 'careers'

export const FILE_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  zip: 'application/zip',
}

export interface FileInfo {
  group: FileGroup
  name: string
  size: number
}

export interface SubmissionInput {
  kind: FormKind
  language: string
  fields: Record<string, string>
  consent: boolean
  website: string
  startedAt: number
  files: FileInfo[]
}

export interface UploadTicket extends FileInfo {
  pathname: string
  contentType: string
  uploadToken: string
  uploaded?: boolean
}

export interface SubmissionSession {
  id: string
  token: string
  expiresAt: number
  files: UploadTicket[]
  status?: 'ready' | 'submitted'
}

export type SubmissionState = 'ready' | 'sending' | 'sent' | 'uncertain' | 'submitted'

export function fileExtension(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

export function fileAllowed(file: FileInfo) {
  const extension = fileExtension(file.name)
  return file.group === 'application'
    ? ['pdf', 'doc', 'docx'].includes(extension)
    : ['pdf', 'zip'].includes(extension)
}
