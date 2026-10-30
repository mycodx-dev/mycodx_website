import { randomUUID } from 'node:crypto'
import { FILE_TYPES, fileExtension } from '../shared/forms.ts'
import { sha256 } from '../server/supabase.ts'
import { FormError } from '../server/validation.ts'

// In-memory RPC/Storage port. SQL constraints are tested separately in supabase/tests.
export function recruitDatabaseFixture(now, options = {}) {
  const applications = new Map()
  const objects = new Map()
  const notifications = new Map()
  const calls = []
  const database = {
    async rpc(name, p) {
      calls.push({ name, args: structuredClone(p) })
      if (name === 'recruit_begin_application') {
        const payload = JSON.stringify([p.p_fields, p.p_files, p.p_language, p.p_consent_version])
        let app = [...applications.values()].find(a => a.key === p.p_idempotency_key_hash)
        if (app && app.payload !== payload) throw new FormError('IDEMPOTENCY_CONFLICT', 409)
        if (!app) {
          app = { id: p.p_id, key: p.p_idempotency_key_hash, payload, stage: 'staging', created_at: new Date(now).toISOString(),
            files: p.p_files.map((f, slot) => {
              const id = randomUUID(), extension = fileExtension(f.name)
              return { id, application_id: p.p_id, slot, file_group: f.group, original_name: f.name,
                extension, content_type: FILE_TYPES[extension], size_bytes: f.size,
                object_path: `v1/${p.p_id}/${id}.${extension}`, ready: false }
            }) }
          applications.set(app.id, app)
        }
        if (options.loseBegin) { options.loseBegin = false; throw new Error('lost response after staging insert') }
        return structuredClone(app)
      }
      const app = applications.get(p.p_application_id)
      if (name === 'recruit_submission_status') return app ? { stage: app.stage } : null
      if (name === 'recruit_verify_file') {
        if (app.stage !== 'staging') throw new Error('not staging')
        const file = app.files.find(f => f.id === p.p_file_id)
        if (sha256(objects.get(file.object_path)) !== p.p_sha256) throw new Error('hash mismatch')
        file.ready = true
        return null
      }
      if (name === 'recruit_finalize_application') {
        if (!app.files.every(f => f.ready)) throw new Error('not ready')
        if (app.stage !== 'submitted') {
          app.stage = 'submitted'
          notifications.set(app.id, { status: 'pending', recipient: p.p_recipient, provider: p.p_provider, attempts: 0 })
        }
        if (options.loseFinalize) { options.loseFinalize = false; throw new Error('lost committed transaction response') }
        return { stage: 'submitted' }
      }
      const notification = notifications.get(app.id)
      if (name === 'recruit_claim_notification') {
        if (notification.status !== 'pending') return null
        if (notification.provider && notification.provider !== p.p_provider) throw new Error('provider mismatch')
        Object.assign(notification, { status: 'sending', provider: p.p_provider, claim_token: randomUUID() })
        notification.attempts++
        if (options.loseClaim) { options.loseClaim = false; throw new Error('claim receipt lost') }
        return structuredClone(notification)
      }
      if (name === 'recruit_finish_notification') {
        if (notification.claim_token !== p.p_claim_token) throw new Error('wrong claim')
        if (options.failFinish) throw new Error('receipt storage unavailable')
        Object.assign(notification, { status: p.p_outcome, messageId: p.p_message_id, errorCode: p.p_error_code })
        if (options.loseFinish) { options.loseFinish = false; throw new Error('receipt write succeeded, response lost') }
        return null
      }
      throw new Error(`Unexpected RPC: ${name}`)
    },
    async persistFile(file, bytes) {
      if (options.failFile === file.slot) throw new Error('storage unavailable')
      if (objects.has(file.object_path) && sha256(objects.get(file.object_path)) !== sha256(bytes)) throw new FormError('FILE_CONFLICT', 409)
      objects.set(file.object_path, Buffer.from(bytes))
      return sha256(bytes)
    },
  }
  return { database, applications, objects, notifications, calls }
}
