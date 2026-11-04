export type ReviewStatus = 'unread' | 'reviewed'
export interface AdminUser { email: string; expiresAt: number }
export interface ApplicationCursor { time: string; id: string }
export interface AdminApplicationSummary {
  id: string
  name: string
  area: string
  experience: string
  review_status: ReviewStatus
  submitted_at: string
  version: number
}
export interface AdminApplicationDetail {
  application: AdminApplicationSummary & {
    email: string
    phone: string
    education: string
    message: string
    consented_at: string
    consent_version: string
    expires_at: string
    reviewed_at: string | null
  }
  files: { id: string; group: string; name: string; size: number; content_type: string }[]
}
export interface AdminApplicationList {
  items: AdminApplicationSummary[]
  nextCursor: ApplicationCursor | null
}
