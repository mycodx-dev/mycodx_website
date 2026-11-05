import type { PublicationContent } from '../shared/publications.ts'
import { FormError } from './validation.ts'

function text(value: unknown, limit: number, required = false) {
  if (typeof value !== 'string' || value.length > limit || Array.from(value).some(c=>c.charCodeAt(0)===127||(c.charCodeAt(0)<32&&![9,10,13].includes(c.charCodeAt(0))))) throw new FormError('INVALID_FIELDS')
  const clean = value.trim()
  if (required && !clean) throw new FormError('INVALID_FIELDS')
  return clean
}
export function validatePublication(value: unknown): PublicationContent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new FormError('INVALID_FIELDS')
  const v = value as Record<string, unknown>
  if (!Number.isInteger(v.year) || Number(v.year) < 1900 || Number(v.year) > 2200) throw new FormError('INVALID_FIELDS')
  if (!v.description || typeof v.description !== 'object' || Array.isArray(v.description)) throw new FormError('INVALID_FIELDS')
  const description = v.description as Record<string, unknown>
  let url = text(v.url, 1000, true)
  if (!/^\/papers\/[A-Za-z0-9_-]+\.pdf$/i.test(url)) {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error()
      url = parsed.href
    } catch { throw new FormError('PUBLICATION_INVALID_URL') }
  }
  const doi = text(v.doi ?? '', 250)
  if (doi && !/^10\.\d{4,9}\/\S+$/i.test(doi)) throw new FormError('PUBLICATION_INVALID_DOI')
  const result: PublicationContent = {
    year: Number(v.year), title: text(v.title, 500, true), authors: text(v.authors, 2000, true),
    mycodxAuthors: text(v.mycodxAuthors ?? '', 1000), journal: text(v.journal, 300, true),
    volume: text(v.volume ?? '', 100), article: text(v.article ?? '', 100), doi, url,
    description: { ko: text(description.ko ?? '', 2000), en: text(description.en ?? '', 2000),
      ...(description.fr !== undefined ? { fr: text(description.fr, 2000) } : {}),
      ...(description.ja !== undefined ? { ja: text(description.ja, 2000) } : {}) },
  }
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > 38000) throw new FormError('REQUEST_TOO_LARGE', 413)
  return result
}
