import { FormError } from './validation.ts'

type Service = 'blob' | 'supabase'
type Operation = 'read_json' | 'create_json' | 'read_file' | 'upload_token' |
  'recruit_begin_application' | 'recruit_submission_status' | 'recruit_verify_file' |
  'recruit_finalize_application' | 'recruit_claim_notification' | 'recruit_finish_notification' |
  'storage_upload' | 'storage_download' | 'storage_sign' | 'auth_login' | 'auth_user' | 'auth_logout' |
  'recruit_is_admin' | 'recruit_admin_list' | 'recruit_admin_detail' | 'recruit_admin_search' |
  'recruit_set_review_status' | 'recruit_prepare_download' | 'recruit_record_download' |
  'news_admin_list' | 'news_admin_detail' | 'news_save' | 'news_publish' | 'news_public_list'

// Fixed codes only: never copy messages, URLs, request bodies, paths or stacks.
const NETWORK_CODES = new Set([
  'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_SOCKET',
  'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'DEPTH_ZERO_SELF_SIGNED_CERT',
])
const PROVIDER_CODES = new Set([
  '42501', '42883', '42P01', '42703', '23502', '23503', '23505', '23514', 'P0001',
  'PGRST202', 'PGRST301', 'PGRST302', 'PGRST303', 'PGRST204',
])

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function failureReason(error: unknown) {
  let item = record(error)
  for (let depth = 0; depth < 4; depth++) {
    if (typeof item.code === 'string' && NETWORK_CODES.has(item.code)) return item.code
    if (item.name === 'TimeoutError' || item.name === 'AbortError') return 'TIMEOUT_OR_ABORT'
    item = record(item.cause)
  }
  return 'UNEXPECTED_ERROR'
}

export class ServiceOperationError extends FormError {
  diagnostic: { service: Service; operation: Operation; reason: string; httpStatus?: number; providerCode?: string }

  constructor(service: Service, operation: Operation, error: unknown, httpStatus?: number, providerCode?: unknown) {
    super('UNAVAILABLE', 503)
    this.diagnostic = {
      service, operation, reason: httpStatus === undefined ? failureReason(error) : 'HTTP_ERROR',
      ...(Number.isInteger(httpStatus) && httpStatus! >= 400 && httpStatus! <= 599 ? { httpStatus } : {}),
      ...(typeof providerCode === 'string' && PROVIDER_CODES.has(providerCode) ? { providerCode } : {}),
    }
  }
}

export async function serviceOperation<T>(service: Service, operation: Operation, run: () => Promise<T>): Promise<T> {
  try { return await run() }
  catch (error) {
    if (error instanceof ServiceOperationError || (error instanceof FormError && error.status < 500)) throw error
    throw new ServiceOperationError(service, operation, error)
  }
}

export function serviceFailureLog(error: unknown) {
  return JSON.stringify({ event: 'forms_service_error',
    ...(error instanceof ServiceOperationError ? error.diagnostic : { reason: failureReason(error) }),
  })
}
