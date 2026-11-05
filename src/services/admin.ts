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
      case 'RATE_LIMITED': return '인증 시도가 많습니다. 잠시 후 다시 시도해 주세요. 시간당 시도 횟수가 제한됩니다.'
      case 'CURRENT_PASSWORD_INVALID': return '현재 비밀번호가 일치하지 않습니다.'
      case 'PASSWORD_TOO_SHORT': return '새 비밀번호는 12자 이상으로 입력해 주세요.'
      case 'PASSWORD_TOO_LONG': return '새 비밀번호가 너무 깁니다. 영문·숫자·기호를 사용하거나 길이를 줄여 주세요.'
      case 'PASSWORD_MISMATCH': return '새 비밀번호와 확인 입력이 일치하지 않습니다.'
      case 'PASSWORD_SAME': return '현재 비밀번호와 다른 새 비밀번호를 입력해 주세요.'
      case 'PASSWORD_WEAK': return '더 안전한 비밀번호를 입력해 주세요. 충분한 길이로 영문·숫자·기호를 조합해 주세요.'
      case 'PASSWORD_REAUTH_REQUIRED': return '추가 인증이 필요합니다. 다시 로그인한 후 변경해 주세요. 계속되면 계정 인증 설정을 확인해 주세요.'
      case 'PASSWORD_REJECTED': return '비밀번호를 변경하지 못했습니다. 계정의 비밀번호 정책을 확인해 주세요.'
      case 'PASSWORD_CHANGE_UNCERTAIN': return '비밀번호 변경 결과를 확인하지 못했습니다. 새 비밀번호로 로그인해 보세요. 실패하면 기존 비밀번호로 로그인해 확인해 주세요.'
      case 'VERSION_CONFLICT': return '다른 관리자가 상태를 변경했습니다. 최신 정보를 확인한 뒤 다시 변경해 주세요.'
      case 'PUBLICATIONS_DISABLED': return '논문 관리가 아직 활성화되지 않았습니다. SQL 적용 후 PUBLICATIONS_CMS_ENABLED 설정을 확인해 주세요.'
      case 'PUBLICATION_NOT_FOUND': return '논문을 찾을 수 없습니다.'
      case 'PUBLICATION_INVALID_URL': return '논문 링크는 HTTPS 주소 또는 /papers/파일명.pdf 경로를 입력해 주세요.'
      case 'PUBLICATION_INVALID_DOI': return 'DOI는 10.으로 시작하는 식별자를 입력해 주세요. 예: 10.1234/example'
      case 'PUBLICATION_DOI_EXISTS': return '같은 DOI를 사용하는 논문이 이미 있습니다. 기존 논문을 확인해 주세요.'
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
