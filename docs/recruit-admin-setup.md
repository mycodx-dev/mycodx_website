# 채용 관리자 페이지 설정과 확인

## 접속과 배포

관리자 주소는 `https://mycodx-website.vercel.app/admin`입니다. 이번 코드가 커밋·푸시되고 해당 Vercel 배포가 Ready가 된 뒤 사용할 수 있습니다. 기존 홈페이지 메뉴에는 관리자 링크를 추가하지 않습니다. `mycodx.com`이나 DNS 변경은 필요하지 않습니다.

제공 기능은 이메일·비밀번호 로그인, 지원자 목록(30명씩 최신순), 확인 상태 필터, 상세 조회, 첨부 다운로드, 미확인/확인 완료 변경, 로그아웃입니다. 지원자에게 접수번호를 발급하지 않습니다. 목록에 표시되는 자료는 `stage=submitted`이며 보관 기한이 남아 있는 지원서입니다. 미완료 `staging` 접수는 표시하지 않습니다. 상세 열람만으로 확인 완료가 되지는 않습니다.

기본 관리자 기능에는 추가 패키지나 기존 Vercel 설정 변경이 없습니다. 이후 추가된 검색·필터와 소식 관리에는 **추가 SQL 적용이 필요**하며 [검색·소식 적용 안내](admin-search-news-setup.md)를 먼저 확인합니다. SQL·계정 등록과 실제 배포는 운영자가 진행합니다. 이 기능 구현 과정에서 유료 서비스 가입이나 요금제 변경은 하지 않습니다. 회사 서비스의 실제 운영 호스팅은 각 제공자의 무료 플랜 사용 조건을 별도로 충족해야 합니다.

## 1. Vercel 환경변수 확인

프로젝트 → Settings → Environment Variables에서 **테스트 주소의 배포 Environment**에 아래 값이 있는지 확인합니다. 현재 대표 Vercel 주소는 Production 배포일 수 있으므로 Preview에만 등록하지 않습니다. 값을 변경했다면 재배포합니다.

| 정확한 변수명 | 유형 | 사용 목적 |
| --- | --- | --- |
| `SUPABASE_URL` | Config | 동일 Supabase 프로젝트의 HTTPS URL |
| `SUPABASE_PUBLISHABLE_KEY` | Config | 같은 프로젝트의 `sb_publishable_…` 키. 서버의 Auth 로그인/사용자 검증 요청 |
| `SUPABASE_SECRET_KEY` | Secret | 같은 프로젝트의 `sb_secret_…` 키. 서버 전용 RPC·Storage 서명 |
| `FORM_SIGNING_SECRET` | Secret | 기존 32자 이상 비밀 값. 관리자 쿠키와 접수 토큰의 서명 목적은 구분 |
| `BLOB_READ_WRITE_TOKEN` | Secret | 기존 비공개 Blob. 로그인 시도 횟수 제한 기록 |
| `FORM_ALLOWED_ORIGINS` | Config | 기존 값에 `https://mycodx-website.vercel.app` 포함. 경로·끝 슬래시 없이 쉼표로 구분 |

기본 로그인에는 새 이름의 관리자 변수가 필요하지 않습니다. 소식 관리 전환에는 `NEWS_CMS_ENABLED=true`가 추가로 필요합니다. `NEXT_PUBLIC_SUPABASE_…`나 `VITE_SUPABASE_…`를 읽지 않습니다. 특히 Secret Key에 프런트엔드 접두어를 붙이지 마세요. `VERCEL_URL` 배포 주소는 서버에서 자동 허용됩니다. 관리자 기능은 메일 제공자나 메일 활성화 여부와 독립적입니다. SMTP/Resend 환경변수는 기존대로 둡니다.

## 2. Supabase Auth 계정과 관리자 승인

이미 **Supabase Auth 계정과 활성 허용 목록**을 등록했다면 새 계정을 만들 필요 없이 그 계정으로 로그인합니다. 이카운트 웹메일 계정·비밀번호나 Vercel 계정으로 로그인하는 방식은 아닙니다.

처음 등록할 경우 다음 작업을 Supabase 대시보드에서 직접 진행합니다.

1. Authentication → Users에서 이메일·비밀번호 사용자를 생성합니다. 운영자가 직접 생성한 계정을 사용할 때는 이메일 확인 완료 상태도 확인합니다. 비밀번호는 채팅이나 SQL에 적지 않습니다.
2. 생성한 사용자의 **User UID(UUID)**를 복사합니다. 프로젝트 ID나 이메일 주소가 아닙니다.
3. SQL Editor에서 아래 읽기 전용 SQL로 기존 승인 상태를 확인합니다. UUID 자리만 실제 값으로 바꿉니다.

```sql
select user_id, active
from public.recruit_admins
where user_id = 'REPLACE_WITH_AUTH_USER_UUID'::uuid;
```

4. 행이 없다면 `supabase/verification/03_admin_template.sql`의 등록 블록만 검토하여 직접 실행합니다. 다음 SQL은 **관리자 권한을 부여하는 실제 쓰기 작업**입니다. 신뢰하는 담당자의 UUID인지 확인하세요.

```sql
begin;
insert into public.recruit_admins (user_id, active)
values ('REPLACE_WITH_AUTH_USER_UUID'::uuid, true)
on conflict (user_id) do nothing;
commit;
```

기존 행이 `active=false`이면 위 SQL은 재활성화하지 않습니다. 재승인이 필요한지 먼저 확인하고 해당 UUID에 대해서만 명시적으로 활성화합니다. 마이그레이션 전체를 다시 실행하거나 anon/authenticated에 테이블 권한을 주지 않습니다.

5. Authentication 설정에서 신규 사용자 공개 가입을 비활성화합니다. 관리자 계정만 운영자가 생성하는 구조이며 홈페이지에 가입 기능은 없습니다. Auth 계정 생성만으로 채용 정보 권한이 생기지 않습니다.
6. `/admin`에서 이 Auth 이메일·비밀번호로 로그인합니다. 로그인은 비밀번호 방식이므로 OAuth callback이나 사이트 도메인 변경은 필요하지 않습니다. 추후 비밀번호 재설정 메일 기능을 도입하면 별도로 Auth URL 설정이 필요합니다.

## 인증·권한과 다운로드 흐름

- `/api/admin`은 POST JSON과 `X-Admin-Request: 1` 헤더만 사용합니다. 서버는 기존 Origin 허용 목록과 교차 사이트 요청을 검사합니다.
- Supabase Auth에서 매 요청의 사용자 토큰을 검증합니다. 로그인·세션 확인·비밀번호 변경은 `recruit_is_admin`으로 승인 여부를 확인하고, 목록·상세·상태·다운로드·소식 작업은 해당 RPC 안의 `require_admin` 검사로 승인 여부를 확인합니다. 클라이언트가 전달한 관리자 UUID는 사용하지 않습니다. 작업 RPC가 이미 수행하는 권한 검사를 위해 별도 네트워크 요청을 중복하지 않습니다.
- Supabase Secret Key는 서버에만 있습니다. 개인정보 테이블의 기존 RLS/직접 접근 차단 정책은 유지합니다. Publishable Key만으로 지원서를 읽거나 Storage 파일을 다운받을 수 없습니다.
- 로그인 세션은 서명된 HttpOnly·Secure(배포 시)·SameSite=Strict·호스트 전용 쿠키이며 `/api/admin`으로만 전송됩니다. 토큰이나 지원자 정보를 localStorage/sessionStorage에 저장하지 않습니다. 응답은 `no-store`입니다.
- 세션은 Auth 토큰 유효시간과 1시간 중 짧은 시간까지 유효합니다. refresh token을 저장하거나 자동 갱신하지 않으며 만료 시 다시 로그인합니다. 탭으로 돌아올 때 재검증하며 실패하면 개인정보 화면을 닫습니다.
- 로그아웃은 브라우저 쿠키를 삭제하고 Auth의 해당 세션 로그아웃을 요청합니다. Supabase access JWT 자체는 원래 만료까지 유효할 수 있습니다. 즉시 접근 차단이 필요하면 `recruit_admins.active=false`로 설정하면 다음 API부터 차단됩니다. 이미 발급한 파일 URL은 최대 60초간 남습니다.
- 로그인 시도는 기존 Blob의 원자적 파일 생성으로 IP당/이메일당 시간당 각 10회, 전체 100회로 제한합니다. 성공한 로그인도 횟수에 포함하며 기존 Blob 정리 작업이 만료 기록을 삭제합니다. 이는 추가 유료 서비스 없이 기존 저장소 사용량을 소비합니다.
- 로그인 제한의 세 범위는 병렬로 확인하고 모두 성공한 경우에만 인증을 진행합니다. 일부만 예약된 뒤 다른 범위가 실패하면 예약은 남아 제한이 보수적으로 적용됩니다. 이미 찬 기록은 이진 탐색으로 건너뛰고 마지막 원자적 쓰기 성공으로만 요청을 허용합니다. 빈 버킷은 쓰기 1번으로 처리하며, 100개 중 99개가 찬 경우 기존 쓰기 시도 100번을 쓰기 시도 2번과 최대 7번의 탐색 조회로 줄입니다. 동시 요청·서버 재시작에도 저장소 기준의 제한은 유지합니다.
- 탭 복귀 시 동시에 발생하는 focus/visibilitychange는 진행 중인 세션 확인 하나를 공유합니다. 관리자 데이터나 승인 결과를 장기간 캐시하지 않습니다.
- 상세는 `recruit_admin_detail` RPC가 조회 이력을 남깁니다. 상태 변경은 `version` 비교로 동시 변경을 감지하고 이력을 남깁니다. 충돌·응답 유실은 최신 정보를 다시 읽고 사용자가 확인 후 재시도합니다.
- 다운로드는 `recruit_prepare_download` → 비공개 Storage 서명 URL 생성 → `recruit_record_download` 순서입니다. 감사 기록 저장에 실패하면 URL을 반환하지 않습니다. 최대 60초, 보관 만료까지 남은 시간보다 길게 발급하지 않습니다. URL은 첨부 다운로드용이며 주소·로그에 원본 파일명을 넣지 않습니다. 다운로드 파일명이 UUID일 수 있으므로 화면의 원본명을 함께 참고합니다.
- 감사 로그의 다운로드 기록은 **링크 발급 이력**입니다. 사용자가 실제로 저장 완료했음을 증명하지 않습니다. 다운로드 링크와 파일은 외부에 공유하지 않습니다.

## 배포 후 직접 확인

실제 개인정보 대신 가상 지원서로 확인합니다. 관리자 비밀번호나 서명 URL을 캡처·공유하지 않습니다.

1. 로그아웃/시크릿 창의 `/admin`에는 로그인 화면만 표시되어야 합니다.
2. 승인된 Auth 계정으로 로그인하면 앞서 `submitted`로 확정한 테스트 지원서가 나타나야 합니다.
3. 지원자 이름을 눌러 입력 필드·원본 파일명·보관 만료일을 확인합니다.
4. 파일 다운로드 후 원본이 열리는지 확인합니다. 파일 원본은 Vercel API를 거치지 않고 Supabase에서 내려옵니다.
5. 확인 완료로 변경하고 필터·새로고침 후 유지되는지 확인합니다. 다시 미확인으로 바꿀 수도 있습니다.
6. 로그아웃하면 목록·상세가 사라져야 합니다. Auth에만 존재하고 허용 목록에 없는 테스트 계정은 로그인하지 못해야 합니다.
7. Supabase SQL Editor에서 다음 읽기 전용 쿼리로 이력을 확인합니다. 실제 지원자 내용은 조회하지 않습니다.

```sql
select action, count(*) as events
from public.recruit_audit_logs
where created_at > now() - interval '1 day'
group by action order by action;
```

예상 action은 `view_detail`, `download_url_issued`, `mark_reviewed`, `mark_unread`입니다. 상세 재조회 때 조회 이력이 추가되는 것은 정상입니다.

## 오류 점검과 남은 운영 작업

| 현상 | 확인할 사항 |
| --- | --- |
| `/admin`이 404 | 새 커밋 배포 완료 여부와 접속한 배포 주소 |
| 로그인 전 503 | 해당 배포의 위 환경변수 6개, 같은 프로젝트 키인지, Supabase 상태 |
| 로그인 실패 | Auth 이메일·비밀번호·이메일 확인 상태, 해당 User UID의 `recruit_admins.active=true` |
| 403 FORBIDDEN | `FORM_ALLOWED_ORIGINS`에 현재 주소의 정확한 origin 포함 여부 |
| 429 | 시간당 로그인 제한. 반복 클릭을 멈추고 이후 시간대에 재시도 |
| 목록에 테스트 지원서 없음 | DB `stage=submitted`, 보관 기한, 필터, 같은 Supabase 프로젝트인지 |
| 저장 상태 충돌 | 화면에 다시 읽힌 최신 상태를 확인한 후 필요할 때 변경 |
| 다운로드 실패 | 파일 `ready`, 비공개 버킷, 보관 기한, 서명·감사 RPC 오류를 서버 로그에서 확인 |

서버 로그에는 고정 오류 코드·서비스·작업 이름만 기록하고 비밀번호·키·지원서 본문·서명 URL을 남기지 않습니다. 브라우저 개발자 도구의 인증 요청 본문에는 입력한 비밀번호가 있으므로 그대로 공유하지 마세요.

로컬 검증은 `npm test`, `npm run lint`, `npm run build`로 실행합니다. 단위 테스트는 서비스 대역을 사용합니다. 실제 프로젝트의 Auth·RLS·RPC·Storage 권한 검증은 위 배포 테스트를 별도로 진행해야 합니다. 로컬 UI 개발은 `.env.local`과 `npm run dev:api`, `npm run dev`를 사용하고 실제 개발 서버 origin을 `FORM_ALLOWED_ORIGINS`에 추가합니다.

이 변경은 관리자 기능까지입니다. 기존 daily cron은 Blob 임시 자료 정리용이며 **Supabase 보관 만료 자료의 물리 삭제, DB/Storage 암호화 백업 및 복구 자동화, 알림 대기 작업 재처리는 아직 구현되지 않았습니다.** 관리자 화면은 만료 자료를 숨길 뿐 삭제·백업을 대신하지 않습니다. [저장 API 운영 조건](recruit-storage-setup.md)의 후속 작업을 운영 전 완료해야 합니다.

공식 참고: [Supabase Auth REST API](https://supabase.github.io/auth/), [Auth 세션](https://supabase.com/docs/guides/auth/sessions), [Storage 서명 URL](https://supabase.com/docs/reference/javascript/file-buckets-createsignedurl).
