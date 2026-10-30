# 채용 DB · Storage 적용 안내

이 폴더는 **사용자가 Supabase SQL Editor에서 직접 적용하는 SQL**입니다. 작성 과정에서 실제 Supabase에 접속하거나 SQL을 실행하지 않았습니다. 기존 홈페이지, Vercel Blob 업로드, SMTP/Resend, Vercel 설정은 수정하지 않았습니다.

## 적용 전 확인

1. 대상 Supabase 프로젝트가 별도 홈페이지용 프로젝트인지 확인합니다. 테스트는 별도 테스트 프로젝트를 권장합니다.
2. Storage에 `recruit-files` 버킷이 있고 **Private**인지 확인합니다. 이 마이그레이션은 버킷을 생성하거나 설정을 변경하지 않습니다.
3. Storage 대시보드에서 파일 크기 제한을 `10485760` bytes(10 MiB)로 설정합니다. 허용 MIME은 `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/zip`입니다. 버킷 한도와 별도로 RPC가 지원서 전체 10 MiB·최대 10개를 검사합니다.
4. 이전 설계안의 SQL을 이미 실행했다면 새 SQL을 바로 실행하지 마세요. 아래 사전 점검 결과에 `recruit_*` 객체가 있으면 기존 구조·데이터를 먼저 확인하고 별도 변경 마이그레이션이 필요합니다. 테이블을 삭제하여 맞추지 않습니다.
5. SQL Editor의 실행 역할은 `postgres`를 사용합니다. Publishable/Secret Key나 비밀번호를 SQL에 입력하지 않습니다.
6. 실제 개인정보가 이미 있는 프로젝트라면 스키마·데이터·Storage 파일을 별도로 백업한 뒤 적용합니다.

## SQL Editor 실행 순서

| 순서 | 파일 | 수행 내용 |
| --- | --- | --- |
| 1 | [verification/01_preflight.sql](verification/01_preflight.sql) | 읽기 전용: 기존 객체·버킷·정책·기본 권한 확인 |
| 2 | [migrations/202610300001_recruit.sql](migrations/202610300001_recruit.sql) | **파일 전체를 한 번에** 실행: 테이블·RPC·권한·정책 생성 |
| 3 | [verification/02_verify.sql](verification/02_verify.sql) | 읽기 전용: 적용 결과와 효과적인 권한 검사 |
| 4 | [verification/03_admin_template.sql](verification/03_admin_template.sql) | 관리자 계정 준비 후 주석의 UUID 템플릿을 수정하여 별도 실행 |

2번 SQL은 `BEGIN`부터 `COMMIT`까지 한 트랜잭션입니다. 함수만 선택 실행하거나 중간부터 실행하지 않습니다. 오류가 발생하면 새 쿼리에서 `ROLLBACK;`으로 남은 트랜잭션을 종료한 뒤 원인을 확인합니다. 마커가 없고 사전 점검에서 생성 객체도 없으면 실패 원인을 해결한 다음 전체 파일을 다시 적용할 수 있습니다.

이미 성공한 마이그레이션을 다시 실행하면 `Recruit objects already exist` 오류로 **변경 전에 중단**합니다. 데이터와 관리자 설정을 초기화하지 않습니다. `IF NOT EXISTS`로 잘못된 기존 스키마를 조용히 통과시키거나 `DROP TABLE`로 다시 만드는 방식은 사용하지 않았습니다.

Supabase CLI를 사용한 적이 없는 현재 작업 방식에서는 이 파일이 `supabase_migrations.schema_migrations`에 자동 등록되는 것은 아닙니다. 자체 마커 `recruit_private.migrations`로 SQL Editor 적용 이력을 확인합니다. 나중에 CLI 마이그레이션을 도입하면 해당 이력과 조정한 후 사용합니다.

## 예상 생성 결과

- `public` 테이블 5개: `recruit_applications`, `recruit_application_files`, `recruit_admins`, `recruit_notifications`, `recruit_audit_logs`.
- 비공개 보조 스키마 `recruit_private`: RLS가 활성화된 적용 이력 테이블 1개와 보조 함수 4개. Data API의 exposed schemas에 추가하지 않습니다.
- 서버 전용 공개 RPC 12개. 모두 `SECURITY DEFINER`, 소유자 `postgres`, 고정된 빈 `search_path`를 사용합니다.
- 모든 개인정보 테이블 RLS 활성화. `PUBLIC`, `anon`, `authenticated`, **`service_role`도 직접 테이블 접근 불가**입니다. 서버는 지정된 RPC로만 접근합니다.
- `recruit-files`에 대한 브라우저 직접 접근을 차단하는 restrictive Storage 정책 1개. 다른 버킷의 기존 정책은 변경하지 않습니다.
- 관리자, 지원서, 파일, 알림 데이터는 자동 생성하지 않습니다. 지원자에게 표시하는 접수번호 컬럼·시퀀스도 없습니다.

`02_verify.sql`의 기대 결과:

| 검사 | 정상 결과 |
| --- | --- |
| 마이그레이션 마커 | `202610300001_recruit` 1행 |
| 이력 테이블 RLS | `migration_ledger_rls_enabled=true` |
| 테이블 | 5행 모두 RLS `true`, 소유자 `postgres` |
| 직접 테이블/컬럼 권한 누출 | 0행 |
| 개인정보 테이블 브라우저 정책 | 0행 — 허용 정책 없이 차단 |
| RPC | 12행, `anon_execute=false`, `authenticated_execute=false`, `server_execute=true` |
| 보조 함수 공개 실행 | 0행, private schema access도 모두 `false` |
| 버킷 | 1행, `public=false` |
| Storage 정책 | `RESTRICTIVE`, `ALL`, 대상 `anon`·`authenticated` |
| 알림 누락·조기 생성·보관기간 이상 | 모두 0 |

커스텀 역할의 상속 권한 등이 접근 차단을 무력화하면 마이그레이션 자체가 예외를 발생시켜 전체 롤백합니다. 기존 역할 권한을 광범위하게 바꾸지 말고 어떤 상속/기본 권한이 원인인지 먼저 확인합니다.

## 관리자 등록

1. Supabase Authentication에서 담당자별 이메일·비밀번호 계정을 생성합니다. 공개 회원가입은 비활성화합니다.
2. Auth 사용자 UUID를 복사합니다. 비밀번호를 `recruit_admins`에 저장하지 않습니다.
3. `03_admin_template.sql`의 주석을 참고해 해당 UUID만 등록합니다. 반복 실행은 기존 계정을 수정하지 않으므로 비활성 계정도 자동 재활성화되지 않습니다. 이메일 도메인이나 사용자 메타데이터는 승인 근거가 아닙니다.
4. 회수 시 `active=false`로 변경합니다. 이후 RPC의 권한 검사는 즉시 거부되며, 기존 서명 URL은 만료 전까지 유효할 수 있습니다.

관리자 추가·비활성화는 SQL Editor의 운영자만 수행합니다. 서버 Secret Key로도 테이블 직접 수정이나 관리자 자기 등록 RPC를 제공하지 않습니다.

## RPC 계약 — 다음 단계 API에서 사용

모든 RPC는 Vercel 서버의 `SUPABASE_SECRET_KEY`에 대응하는 `service_role`만 호출할 수 있습니다. 승인 관리자라도 브라우저에서 사용자 JWT로 직접 RPC를 호출하면 거부됩니다. 서버는 먼저 Auth 토큰을 검증하고 **검증된 UUID**를 `p_actor`에 전달해야 합니다. 클라이언트가 보낸 `p_actor`를 신뢰하면 안 됩니다. RPC도 해당 UUID의 활성 관리자 여부를 재검사합니다.

| RPC | 역할 |
| --- | --- |
| `recruit_begin_application` | 입력·파일 목록 검증, 지원서와 예정 파일 행을 한 트랜잭션으로 생성. 같은 키·내용이면 기존 결과 반환 |
| `recruit_verify_file` | 서버가 원본 검증을 마친 파일의 해시·Storage 객체 ID·수정 시각·크기 확인 및 검증 완료 기록 |
| `recruit_finalize_application` | 필수 파일 재확인, 접수 완료와 알림 대기 생성의 원자적 처리 |
| `recruit_submission_status` | 공개 접수 API에 필요한 최소 저장 상태 조회. 외부 API가 제출 토큰부터 검증해야 함 |
| `recruit_claim_notification` | 대기 알림을 한 번만 선점하고 무작위 claim token 반환 |
| `recruit_finish_notification` | 같은 claim token으로 결과 확정. 불확실한 시도의 늦은 성공 영수증도 기록 가능 |
| `recruit_is_admin` | 검증된 사용자 UUID의 관리자 활성 여부 확인 |
| `recruit_admin_list` | 접수 완료·미만료 지원서 목록, 확인 상태 필터, 커서 페이지 조회 |
| `recruit_admin_detail` | 상세·파일 목록 조회와 열람 감사 기록. 중복 방지 키·해시·Storage 경로는 제외 |
| `recruit_set_review_status` | 버전 비교 후 확인 상태와 감사 기록을 같은 트랜잭션으로 변경 |
| `recruit_prepare_download` | 권한·보관기간 확인 후 서버용 경로와 최대 60초 TTL 반환 |
| `recruit_record_download` | Storage 서명 URL 생성 성공 후 발급 감사 기록. URL 자체는 저장하지 않음 |

`recruit_begin_application`의 인자:

```text
p_id: 기존 Vercel 제출 세션과 연결할 서버 생성 UUID
p_idempotency_key_hash: 제출 시작 전에 보관한 암호학적 난수 키의 SHA-256(소문자 hex)
p_fields: {name,email,phone,area,education,experience,message}
p_files: [{group,name,size}, ...]   // 기존 폼 파일 목록과 같은 형식
p_language: ko / en / ja / fr
p_consent: true
p_consent_version: 서버에서 정한 동의 문구 버전
```

`message`는 빈 문자열을 허용하지만 키는 필요합니다. 지원 분야·학력·경력은 기존 다국어 문자열을 보존합니다. CAPTCHA/허니팟·요청 제한·Origin·파일 시그니처 검증은 기존 API에서 계속 수행합니다.

같은 키로 다시 호출할 때 다른 `p_id`가 전달되어도 원래 UUID를 반환합니다. 서버는 **반환된 UUID·최초 `created_at`·파일 목록**을 사용해야 합니다. Blob 세션의 기준 시각도 재시도마다 새로 만들지 않습니다. `staging_expires_at`도 함께 반환하며 재시도로 연장되지 않습니다. 본문이 달라지면 `IDEMPOTENCY_CONFLICT`로 거부합니다. 같은 사람이 새 키로 다른 지원서를 작성하는 것은 별개 접수입니다. 중복 방지 키는 본인 확인 수단이 아닙니다.

`recruit_verify_file`은 파일 바이트를 읽거나 악성코드를 검사하지 않습니다. 다음 단계 서버가 검증된 바이트를 `upsert:false`로 Supabase에 업로드하고, 저장 원본의 크기·SHA-256을 확인한 뒤 호출해야 합니다. RPC는 Storage 메타데이터의 크기·객체 ID·수정 시각을 확인합니다. 접수 확정 시에도 변경 여부를 다시 검사합니다. Secret Key를 가진 서버/운영자가 파일을 덮어쓰거나 버킷을 Public으로 바꾸지 않도록 관리해야 합니다.

`recruit_finalize_application`의 `p_recipient`는 서버의 `MAIL_TEST_RECIPIENT` 또는 `CAREERS_TO`에서 결정합니다. 클라이언트가 정하게 하지 않습니다. `p_provider`는 `smtp`, `resend`, 또는 미선택 시 `null`입니다. 메일 자격정보가 없어도 DB 접수와 대기 알림은 기록할 수 있습니다. 재호출은 알림을 추가하거나 수신처·발신 방식을 바꾸지 않습니다.

접수일은 최종 확정 서버 시각이며, 만료일은 UTC 기준 `submitted_at + interval '1 year'`입니다. 동의 시각은 최초 접수 시작 요청을 서버가 받은 시각으로 기록합니다. 현재 동의 문구와 버전을 함께 관리해야 합니다.

## 알림 중복 방지와 오류 의미

```text
pending → sending → accepted / failed / uncertain
```

- 알림 행은 지원서 UUID를 PK로 사용합니다. 동시 접수 확정도 1행만 생성합니다.
- `claim`은 `pending`만 선점합니다. 반환값이 `null`이면 보내지 않습니다. 한 번의 claim 결과에 대해 전송 함수를 한 번만 호출합니다.
- SMTP/Resend의 최종 접수 영수증을 확인한 후에만 `accepted`와 메시지 ID를 기록합니다. 실제 수신함 도착을 보장하는 상태는 아닙니다.
- `failed`는 발송 시작 전 구성/파일 오류 또는 **확실한 미접수 거부**에만 사용합니다. 현재 메일 어댑터의 일반 예외만으로 이를 판단하지 않습니다.
- 연결 유실·시간 초과·접수 후 DB 기록 실패는 `uncertain`으로 취급합니다. 다른 제공자로 자동 전환하지 않습니다.
- 10분 넘게 `sending`인 행을 다시 claim하면 `uncertain`으로 전환하고 `null`을 반환합니다. 이미 보내졌을 수 있으므로 재선점하지 않습니다.
- `failed`·`uncertain` 모두 자동 재시도하지 않습니다. 운영자가 실제 수신과 제공자 기록을 확인한 뒤 별도 복구 절차를 결정해야 합니다.
- `sending`을 기록한 직후 함수가 종료되어 실제 전송을 못 했을 수도 있습니다. SMTP와 DB 간 정확히 한 번 전송을 보장할 수 없으므로 중복보다 결과 불확실 상태를 우선합니다.
- 오류 코드는 고정된 코드만 저장하며, 공급자 원문 오류·본문·파일·토큰을 저장하지 않습니다. PostgreSQL 오류의 상세 내용도 API 로그/브라우저로 그대로 반환하지 않습니다.

현재 단계는 DB 계약만 제공합니다. 대기 알림 검색·스케줄러·장애 복구 실행 코드는 다음 단계입니다. 복구용 재전송 버튼이나 RPC를 임의로 추가하지 않았습니다.

## Storage 정책과 다운로드

버킷의 Public 여부는 RLS와 별개로 중요합니다. 버킷을 Public으로 바꾸면 파일 제공 경로의 보호가 달라지므로 반드시 Private을 유지합니다. 마이그레이션·파일 검증·접수 확정·다운로드 준비 시 이를 확인합니다.

restrictive 정책은 기존 permissive 정책의 OR 조건에 의해 채용 버킷이 열리지 않도록 합니다. Storage `service_role` 접근은 RLS를 우회합니다. 서버는 고정 버킷과 DB가 반환한 경로만 사용해야 합니다. 파일 객체 생성·삭제는 Storage API로 수행하며 `storage.objects`를 SQL로 수정하지 않습니다.

다운로드 API의 순서:

1. Auth 토큰 검증 → `recruit_prepare_download(검증된 사용자 UUID, 파일 UUID)`.
2. 반환된 버킷·경로로 Storage `createSignedUrl`을 호출합니다. TTL은 반환값 이하이고 최대 60초입니다. 원본명은 다운로드 파일명으로만 사용합니다.
3. 생성 성공 후 `recruit_record_download`를 호출합니다. 감사 기록 실패 시 URL을 반환하지 않습니다.
4. URL을 `no-store` 응답으로 반환하고 로그·DB·분석 도구에 남기지 않습니다.

서명 URL은 발급 후에는 소지자가 사용할 수 있는 임시 권한입니다. 계정 비활성화만으로 이미 발급한 URL을 즉시 취소하지 못합니다. TTL은 서버가 지켜야 하는 계약이며, SQL이 Storage API에 요청하는 임의 TTL까지 강제할 수는 없습니다. 다운로드 완료가 아니라 **링크 발급**을 감사 기록으로 남깁니다.

## SQL 단계 이후 연결 상태

채용 저장 API와 기존 Blob·SMTP/Resend 연결 코드를 추가했습니다. 적용된 SQL을 다시 실행할 필요는 없습니다. 환경변수와 Vercel 주소 테스트 절차, 현재 미구현 운영 작업은 [채용 저장 API 안내](../docs/recruit-storage-setup.md)를 참고하세요.

## SQL 단계에 포함하지 않은 실행 작업

- 기존 Vercel Blob 업로드 및 SMTP/Resend 호출 코드 연결, 관리자 API·화면.
- 실제 Supabase SQL 실행, 관리자 계정 생성, 비밀번호·키 등록.
- 만료 자료와 미완료 업로드의 물리 삭제 작업. 현재 RPC는 미완료 접수를 24시간 후 거부하고, 보관 만료 지원서를 조회·다운로드·발송 선점에서 차단합니다. **자동 삭제 스케줄러는 아직 없습니다.**
- 실제 서명 URL 발급·이메일 발송·파일 업로드 검증.
- 백업 실행과 복구 스케줄러. DB 백업에는 Storage 원본 파일이 포함되지 않으므로 별도 백업·삭제 이력 관리가 필요합니다.

이 SQL 적용만으로 기존 홈페이지의 동작은 바뀌지 않습니다. 다음 단계에서 서버 코드를 연결하고 Vercel 제공 주소에서 테스트합니다. 기존 `mycodx.com`, 원본 GitHub Pages, `vercel.json`은 이번 단계에서 변경하지 않습니다.

## 로컬 검증

`tests/`는 작성자가 빈 로컬 PostgreSQL에서 검증하기 위한 도구입니다. **실제 Supabase SQL Editor에서 실행하지 않습니다.** 모의 `auth`/`storage` 테이블과 가상 데이터만 사용하며 실제 Storage API·Auth 서버·메일은 호출하지 않습니다. 런타임 의존성을 추가하지 않습니다.

별도 PostgreSQL 16 클러스터를 `/private/tmp/mycodx-recruit-pg.*`에 초기화하고 Unix 소켓 전용으로 시작한 뒤, 빈 `mycodx_recruit_test` DB에 다음 순서로 적용합니다.

1. `tests/bootstrap.sql` — 모의 Supabase 역할과 넓은 기존 Storage 정책.
2. `migrations/202610300001_recruit.sql`.
3. `python3 supabase/tests/test_local.py <전용 Unix 소켓 디렉터리> <포트>`.

테스트는 실제 SQL의 권한 거부, 동시 제출/확정/알림 선점, 파일 불일치, 원자적 롤백, 관리자 비활성화, 상태 변경 충돌, Storage 정책 충돌, 만료 접근, 재실행 차단을 검사합니다. 테스트 후 해당 임시 클러스터만 종료합니다.

2026-10-30 PostgreSQL 16.15의 분리된 로컬 테스트 DB에서 **13개 통합 검증 그룹이 통과**했습니다. 실제 Supabase의 Storage/GoTrue/PostgREST API까지 검증한 결과는 아니므로, 적용 후 위 검증 SQL과 다음 단계의 서비스 연결 테스트가 필요합니다.

공식 참고: [DB 함수와 권한](https://supabase.com/docs/guides/database/functions), [Storage 접근 제어](https://supabase.com/docs/guides/storage/security/access-control), [Storage 메타데이터와 API](https://supabase.com/docs/guides/storage/schema/design).
