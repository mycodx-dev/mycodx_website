import type { PublicPublicationsResult } from '../../shared/publications'

export async function readPublications(response: Response): Promise<PublicPublicationsResult> {
  if (!response.ok) throw new Error('Publications unavailable')
  const value = await response.json()
  if (!value || typeof value.enabled !== 'boolean' || !Array.isArray(value.items) ||
    value.items.some((item: Record<string, unknown>) => !item || typeof item.id !== 'string' ||
      !Number.isInteger(item.year) || typeof item.title !== 'string' || typeof item.url !== 'string' ||
      !item.description || typeof item.description !== 'object') ||
    (value.nextCursor !== null && (!Number.isInteger(value.nextCursor?.year) || typeof value.nextCursor?.id !== 'string'))) {
    throw new Error('Invalid publications response')
  }
  return value
}
