export interface PublicationDescription { ko: string; en: string; fr?: string; ja?: string }
export interface PublicationContent {
  year: number
  title: string
  authors: string
  mycodxAuthors: string
  journal: string
  volume: string
  article: string
  description: PublicationDescription
  doi: string
  url: string
}
export interface PublicationPost {
  id: string; draft: PublicationContent; version: number; published_version: number | null
  updated_at: string; published_at: string | null
}
export type PublicationSummary = Omit<PublicationPost, 'draft'> & { title: string; year: number }
export interface PublicationCursor { time: string; id: string }
export interface PublicationAdminList { items: PublicationSummary[]; nextCursor: PublicationCursor | null }
export type PublicPublication = PublicationContent & { id: string }
export interface PublicPublicationsResult {
  enabled: boolean; items: PublicPublication[]; nextCursor: { year: number; id: string } | null
}
