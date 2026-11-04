export class AdminError extends Error {
  code: string
  status: number
  constructor(code: string, status: number) { super(code); this.code = code; this.status = status }
}

export async function adminRequest<T>(action: string, values: Record<string, unknown> = {}, signal?: AbortSignal): Promise<T> {
  const response = await fetch('/api/admin', {
    method: 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Request': '1' },
    body: JSON.stringify({ ...values, action }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new AdminError(typeof data?.error === 'string' ? data.error : 'UNAVAILABLE', response.status)
  if (!data) throw new AdminError('UNAVAILABLE', 503)
  return data as T
}

export function adminErrorMessage(error: unknown) {
  if (error instanceof AdminError) {
    switch (error.code) {
      case 'LOGIN_FAILED': return '로그인 정보를 확인해 주세요. 승인된 관리자 계정만 로그인할 수 있습니다.'
      case 'AUTH_REQUIRED': return '로그인이 만료되었습니다. 다시 로그인해 주세요.'
      case 'ADMIN_FORBIDDEN': return '관리자 접근 권한이 없습니다. 계정 승인 상태를 확인해 주세요.'
      case 'RATE_LIMITED': return '로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요. 시간당 시도 횟수가 제한됩니다.'
      case 'VERSION_CONFLICT': return '다른 관리자가 상태를 변경했습니다. 최신 정보를 확인한 뒤 다시 변경해 주세요.'
      case 'NEWS_DISABLED': return '소식 관리가 아직 활성화되지 않았습니다. SQL 적용 후 NEWS_CMS_ENABLED 설정을 확인해 주세요.'
      case 'NEWS_NOT_FOUND': return '소식을 찾을 수 없습니다.'
      case 'NEWS_SLUG_EXISTS': return '같은 글 주소가 이미 있습니다. 다른 주소를 입력해 주세요.'
      case 'NEWS_SLUG_IMMUTABLE': return '저장한 글의 주소는 변경할 수 없습니다.'
      case 'NEWS_INVALID_URL': return '이미지·관련 링크는 HTTPS 주소 또는 기존 /uploads/ 이미지 경로를 입력해 주세요.'
      case 'NEWS_TOO_LARGE': case 'REQUEST_TOO_LARGE': return '입력한 내용이 너무 큽니다. 본문이나 사진 설명의 분량을 줄여 주세요.'
      case 'NOT_FOUND': case 'SESSION_EXPIRED': return '지원서를 찾을 수 없거나 보관 기간이 만료되었습니다.'
      case 'FORBIDDEN': return '이 주소에서는 관리자 요청이 허용되지 않습니다. 사이트 주소 설정을 확인해 주세요.'
      case 'INVALID_FIELDS': return '입력 내용을 확인해 주세요.'
    }
  }
  return '요청을 완료하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.'
}
