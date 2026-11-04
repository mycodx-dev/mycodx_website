import type { NewsContent } from '../shared/news.ts'
import { FormError } from './validation.ts'
export const NEWS_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
function text(value: unknown, limit: number, required = false) {
  if (typeof value !== 'string' || value.length > limit || Array.from(value).some(c=>c.charCodeAt(0)===127||(c.charCodeAt(0)<32&&![9,10,13].includes(c.charCodeAt(0))))) throw new FormError('INVALID_FIELDS')
  const clean = value.trim()
  if (required && !clean) throw new FormError('INVALID_FIELDS')
  return clean
}
function localized(value: unknown, limit: number, required = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new FormError('INVALID_FIELDS')
  const source = value as Record<string, unknown>
  return { ko: text(source.ko, limit, required), en: text(source.en ?? '', limit),
    ...(source.ja !== undefined ? { ja: text(source.ja, limit) } : {}),
    ...(source.fr !== undefined ? { fr: text(source.fr, limit) } : {}) }
}
function url(value: unknown, image = false) {
  const result = text(value ?? '', 1000)
  if (!result) return ''
  if (image && /^\/uploads\/[A-Za-z0-9_./%()-]+$/.test(result) && !result.includes('..')) return result
  try {
    const parsed = new URL(result)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error()
    return parsed.href
  } catch { throw new FormError('NEWS_INVALID_URL') }
}
export function validateNews(value: unknown): NewsContent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new FormError('INVALID_FIELDS')
  const v = value as Record<string, unknown>
  const id = text(v.id ?? '', 100), date = text(v.date, 10, true)
  if ((id && !NEWS_SLUG.test(id)) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date) throw new FormError('INVALID_FIELDS')
  const category = text(v.category ?? 'News', 30)
  if (!['News', 'Notice', 'Press', 'Exhibition'].includes(category)) throw new FormError('INVALID_FIELDS')
  if (v.photos != null && (!Array.isArray(v.photos) || v.photos.length > 10)) throw new FormError('INVALID_FIELDS')
  const result: NewsContent = { id, visible: true, date, category, title: localized(v.title, 200, true), summary: localized(v.summary, 1000),
    body: localized(v.body ?? { ko: '', en: '' }, 10000), image: url(v.image, true), url: url(v.url),
    imageAlt: localized(v.imageAlt ?? { ko: '', en: '' }, 300),
    photos: ((v.photos ?? []) as Record<string, unknown>[]).map(photo => {
      if (!photo || typeof photo !== 'object' || Array.isArray(photo)) throw new FormError('INVALID_FIELDS')
      const image = url(photo.image, true)
      if (!image) throw new FormError('INVALID_FIELDS')
      return { image, alt: localized(photo.alt, 300), caption: localized(photo.caption ?? { ko: '', en: '' }, 500) }
    }) }
  if (Buffer.byteLength(JSON.stringify(result),'utf8')>180000) throw new FormError('NEWS_TOO_LARGE',413)
  return result
}
