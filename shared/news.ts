import type { NewsContent } from '../src/content/types.ts'
export type { NewsContent }
export interface NewsPost {
  id: string; slug: string; post_number: number; draft: NewsContent; version: number
  published_version: number | null; updated_at: string; published_at: string | null
}
export type NewsPostSummary = Omit<NewsPost, 'draft'> & { title: string }
export interface NewsCursor { time: string; id: string }
export interface NewsAdminList { items: NewsPostSummary[]; nextCursor: NewsCursor | null }
export interface PublicNewsResult { enabled: boolean; items: NewsContent[]; nextCursor: { date: string; slug: string } | null }

export function newsAddress(item: NewsContent) {
  return Number.isSafeInteger(item.postNumber) && item.postNumber! > 0 ? String(item.postNumber) : item.id
}

export function newsSortDate(item: NewsContent) {
  return item.sortDate || item.date
}

export function compareNews(a: NewsContent, b: NewsContent) {
  const dateOrder = newsSortDate(b).localeCompare(newsSortDate(a))
  return dateOrder || (a.id === b.id ? 0 : a.id < b.id ? 1 : -1)
}
