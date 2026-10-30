import type { FileGroup, SubmissionInput, UploadTicket } from '../shared/forms.ts'
import { STORAGE_PREFIX } from './storage.ts'

export interface RecruitFile {
  id: string
  application_id: string
  slot: number
  file_group: FileGroup
  original_name: string
  extension: string
  content_type: string
  size_bytes: number
  object_path: string
}

export interface Manifest extends SubmissionInput {
  id: string
  createdAt: number
  files: Omit<UploadTicket, 'uploadToken'>[]
  recruitFiles?: RecruitFile[]
}

export function submissionPath(id: string, issuedAt: number) {
  return `${STORAGE_PREFIX}submissions/${new Date(issuedAt).toISOString().slice(0, 10)}/${id}/`
}
