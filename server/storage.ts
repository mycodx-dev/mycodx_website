import { get, put, list, del } from '@vercel/blob'
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client'
import { FormError } from './validation.ts'
import type { UploadTicket } from '../shared/forms.ts'

export const STORAGE_PREFIX = 'mycodx-forms-v1/'

export interface FormsStore {
  readJson<T>(path: string): Promise<T | null>
  createJson(path: string, data: unknown): Promise<boolean>
  readFile(path: string, expectedSize: number): Promise<Uint8Array>
  uploadToken(file: Omit<UploadTicket, 'uploadToken'>, expiresAt: number): Promise<string>
}

async function readBounded(stream: ReadableStream<Uint8Array>, maxBytes: number) {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel()
        throw new FormError('FILE_SIZE')
      }
      chunks.push(value)
    }
    return Buffer.concat(chunks)
  } finally { reader.releaseLock() }
}

export function createBlobStore(token: string): FormsStore {
  return {
    async readJson<T>(path: string) {
      const result = await get(path, { access: 'private', token, useCache: false })
      if (!result) return null
      if (result.statusCode !== 200) throw new Error('Unexpected blob response')
      const body = await readBounded(result.stream, 32 * 1024)
      return JSON.parse(body.toString('utf8')) as T
    },
    async createJson(path, data) {
      try {
        await put(path, JSON.stringify(data), {
          token, access: 'private', contentType: 'application/json',
          addRandomSuffix: false, allowOverwrite: false, cacheControlMaxAge: 60,
        })
        return true
      } catch (error) {
        // Only an existing object is a conflict. Network/auth/storage errors fail closed.
        // An ambiguous successful write also returns false, so it never authorizes a send.
        if (await this.readJson(path) !== null) return false
        throw error
      }
    },
    async readFile(path, expectedSize) {
      const result = await get(path, { access: 'private', token, useCache: false })
      if (!result || result.statusCode !== 200) throw new FormError('UPLOAD_INCOMPLETE', 409)
      if (result.blob.size !== expectedSize) {
        await result.stream.cancel()
        throw new FormError('FILE_SIZE')
      }
      const bytes = await readBounded(result.stream, expectedSize)
      if (bytes.byteLength !== expectedSize) throw new FormError('UPLOAD_INCOMPLETE', 409)
      return bytes
    },
    uploadToken(file, expiresAt) {
      return generateClientTokenFromReadWriteToken({
        token, pathname: file.pathname, maximumSizeInBytes: file.size,
        allowedContentTypes: [file.contentType], validUntil: expiresAt,
        addRandomSuffix: false, allowOverwrite: false, cacheControlMaxAge: 60,
      })
    },
  }
}

export async function cleanupBlobs(token: string, now = Date.now()) {
  const deadline = Date.now() + 120_000
  let cursor: string | undefined
  let deleted = 0
  do {
    const page = await list({ token, prefix: STORAGE_PREFIX, limit: 1000, cursor })
    const expired = page.blobs.filter(blob => {
      const isRateLimit = blob.pathname.startsWith(`${STORAGE_PREFIX}rate/`)
      const retention = isRateLimit ? 2 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000
      return now - blob.uploadedAt.getTime() > retention
    })
    for (let start = 0; start < expired.length; start += 100) {
      await del(expired.slice(start, start + 100).map(blob => blob.url), { token })
    }
    deleted += expired.length
    if (!page.hasMore) return { deleted, complete: true }
    cursor = page.cursor
  } while (Date.now() < deadline)
  return { deleted, complete: false }
}
