# 채용 저장 API — Vercel 주소에서 검증

이번 변경은 로컬 코드 구현입니다. 기존 SQL 마이그레이션을 다시 실행하지 않습니다. 실제 Supabase 데이터, Vercel 환경변수·배포, 원본 GitHub Pages, `mycodx.com` DNS는 이 작업에서 변경하지 않습니다. 관리자 로그인·화면은 다음 단계입니다.

## 대상 주소와 환경

현재 테스트 대상은 `https://mycodx-website.vercel.app`입니다. 프런트엔드는 같은 출처의 `/api/forms`를 호출하므로 `mycodx.com` 연결이 필요하지 않습니다. 기존 `vercel.json`, Blob 업로드 경로 구조, 메일 어댑터를 유지합니다.

**`vercel.app` 주소라고 반드시 Preview 환경은 아닙니다.** Vercel Deployments에서 대상 배포의 Environment를 확인하고 그 환경에 변수를 등록해야 합니다. 기존 주소가 Production이면 테스트 수신 주소도 Production에 설정합니다. 환경변수 변경 후에는 해당 환경으로 다시 배포해야 적용됩니다. 테스트 환경의 키·Blob·Supabase 프로젝트가 서로 맞는지도 확인합니다.

## 환경변수

| 이름 | 용도 및 값 |
| --- | --- |
| `RECRUIT_FORMS_ENABLED` | 채용 DB 저장 기능. 기본 `false`; 검증용 배포에서만 `true`로 활성화 |
| `SUPABASE_URL` | 기존 등록 이름 그대로 사용. `https://<project-ref>.supabase.co` 형식 |
| `SUPABASE_SECRET_KEY` | 기존 등록 이름 그대로 사용. `sb_secret_…` 서버 키만 지원; `VITE_` 접두어 금지 |
| `SUPABASE_PUBLISHABLE_KEY` | 이번 저장 API에서는 사용하지 않음. 후속 관리자 Auth 단계용 |
| `BLOB_READ_WRITE_TOKEN` | 기존 비공개 Vercel Blob 토큰 |
| `FORM_SIGNING_SECRET` | 기존 32자 이상 서명 비밀. 제출 중 교체하면 이전 토큰을 확인할 수 없음 |
| `FORM_ALLOWED_ORIGINS` | 테스트하는 Vercel 주소를 정확히 포함. 와일드카드 사용 안 함. `VERCEL_URL`은 자동 추가 |
| `CRON_SECRET` | 기존 32자 이상 Blob 정리 인증 값 |
| `CAREERS_TO` | 실제 채용 수신 주소. 기본 `jakim@mycodx.com` |
| `MAIL_TEST_RECIPIENT` | 테스트 수신 주소 `hyemlee@mycodx.com`. Preview는 필수이며 Production 환경의 테스트에도 설정 |
| `MAIL_FORMS_ENABLED` | `false`이면 DB 저장만, `true`와 유효한 발송 설정이 있으면 기존 SMTP/Resend 알림도 실행 |
| `MAIL_PROVIDER` | `smtp` 또는 `resend` 하나만 선택. 자동 전환 없음 |
| SMTP 선택 시 | 기존 `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` |
| Resend 선택 시 | 기존 `RESEND_API_KEY`, `RESEND_FROM` (`MAIL_FROM` 호환 유지) |
| `CONTACT_TO` | 기존 문의 수신 주소. 문의 기능의 설정·동작 유지 |

버킷은 SQL과 동일하게 **비공개 `recruit-files`**로 고정합니다. 별도 버킷 환경변수나 새 의존성을 추가하지 않았습니다. 저장용 설정이 빠지면 채용을 비활성화하며 메일 전송만으로 대신 접수하지 않습니다. 메일 인증정보가 없어도 저장용 설정만 맞으면 DB 접수가 가능합니다.

현 단계에서는 공개 접수를 열기 전에 아래 후속 운영 작업을 완료해야 합니다. 활성화 테스트는 가상 개인정보와 테스트 파일로 진행합니다.

## 저장 순서와 재시도

1. 브라우저가 임의 UUID 요청 키를 **start 요청 전**에 sessionStorage에 저장합니다. 입력 내용·파일을 비교하기 위한 해시와 진행 상태만 보관하며 개인정보 원문·파일명·파일 바이트·업로드 토큰은 저장하지 않습니다.
2. 기존 서버 입력 검증, Origin 검사, 지속형 Blob 속도 제한을 거쳐 `recruit_begin_application`을 호출합니다. DB가 요청 키 해시로 중복을 막고 같은 요청이면 기존 UUID·파일 경로를 반환합니다. 변경된 내용은 거절합니다.
3. DB가 반환한 UUID와 시각으로 비공개 Blob manifest와 기존 방식의 업로드 토큰을 발급합니다. 브라우저는 파일 원본을 Blob에 직접 업로드합니다. 이미 올라간 파일은 재시도 시 생략합니다.
4. `submit`은 파일 바이트 없이 서명 토큰만 전송합니다. 서버가 원본을 읽고 크기·파일 시그니처를 검사합니다. 파일 총합 10 MiB, 최대 10개 제한을 유지합니다.
5. 서버가 Supabase Storage의 `v1/<지원서 UUID>/<파일 UUID>.<확장자>`로 **덮어쓰기 없이** 저장합니다. 저장된 원본을 다시 읽어 SHA-256을 비교한 후 `recruit_verify_file`로 검증 완료를 기록합니다. 파일 경로에는 이름·이메일을 넣지 않습니다.
6. `recruit_finalize_application`이 접수 확정과 이메일 알림 대기 기록을 원자적으로 저장합니다. 이 시점부터 성공 응답은 `submitted`입니다. 보관 만료 시각은 SQL에서 접수일 기준 UTC 1년으로 기록합니다.
7. 메일 발송 가능 시 `recruit_claim_notification`으로 한 번만 선점하고 기존 SMTP/Resend를 호출합니다. 결과는 `accepted` 또는 `uncertain`으로 기록합니다. 실제 받은편지함 수신은 별도 확인이 필요합니다.

DB는 테이블 직접 CRUD가 아니라 기존 서버 전용 RPC로만 접근합니다. 최신 Secret Key는 `apikey` 헤더에 넣고 Bearer JWT로 사용하지 않습니다. 외부 리디렉션을 금지하고 에러·응답에 키나 DB 원문 오류를 포함하지 않습니다.

메일 알림은 기존처럼 원본 첨부를 포함합니다. DB에 수신 주소와 제공자를 고정하므로 환경 설정이 바뀌어도 예전 테스트 알림을 실제 담당자에게 임의로 전환하지 않습니다. 주소가 달라진 작업은 발송 전에 `failed/CONFIGURATION`으로 남깁니다.

## 오류 처리

| 상황 | 결과 |
| --- | --- |
| start 또는 manifest 응답 유실 | 같은 요청 키로 기존 DB 지원서와 Blob 경로를 재사용 |
| Blob 업로드 일부 실패 | 같은 세션으로 미완료 파일을 이어서 업로드; 확정·메일 없음 |
| Supabase 파일 일부만 저장 | `staging` 유지, 저장된 파일 보존; 같은 세션 재시도로 해시 확인 후 진행 |
| 기존 Storage 파일의 내용이 다름 | 덮어쓰지 않고 중단; 접수 확정 안 함 |
| DB 확정 응답 유실 또는 동시 제출 | DB 상태를 재조회; 이미 확정됐다면 성공 반환 |
| 메일 설정 없음 | 접수 성공 + 알림 `pending` |
| 메일 호출 후 오류·타임아웃 | 접수 성공 + 알림 `uncertain`; 자동 재발송·다른 제공자 전환 없음 |
| 메일 선점 후 함수 종료 또는 결과 기록 실패 | 접수는 유지; `sending` 상태는 운영 점검 필요. 이후 선점 호출에서 10분 경과를 확인하면 `uncertain` 전환 |
| 제출 결과를 확인하지 못함 | 새 지원서를 만들지 않고 기존 서명 토큰으로 확인/재시도 |
| 확정 시도 후 입력 내용 변경 | 기존 결과가 불확실한 동안 새 접수 생성 차단; 기존 내용으로 확인 또는 담당자 점검 |
| 업로드·제출 토큰 만료 | 업로드/미완료 확정은 1시간 제한. 상태 확인은 최대 7일. 자동 신규 접수로 전환하지 않고 담당자 점검 |

중복 방지는 같은 요청 키에 대한 보장입니다. 다른 브라우저·탭에서 새 요청을 만들거나 브라우저 저장 데이터를 삭제한 경우를 동일 지원자로 판별하지 않습니다. 실패 정리를 위해 파일을 즉시 삭제하면 동시 요청이 확정한 자료를 지울 수 있으므로, 삭제는 후속 정리 작업에서 DB 상태를 잠근 뒤 진행해야 합니다.

Vercel 함수의 요청·응답 크기 제한을 피하도록 파일은 직접 Blob에 업로드하고 API에는 작은 JSON만 보냅니다. Supabase로의 이동은 서버에서 수행합니다. 6 MiB 초과 파일도 원본 그대로 처리하지만 실제 네트워크·함수 실행 시간 내 완료 여부는 배포 환경에서 확인해야 합니다. 시그니처 검사는 악성코드 검사나 ZIP 내부 검사에 해당하지 않습니다.

## 배포 후 검증 순서

1. 실제 대상 환경에 Supabase URL/Secret Key, Blob 토큰, Origin, 서명/정리 비밀이 등록되어 있는지 확인합니다. SQL과 버킷은 기존 적용본을 그대로 사용합니다.
2. `RECRUIT_FORMS_ENABLED=true`, `MAIL_FORMS_ENABLED=false`, `MAIL_TEST_RECIPIENT=hyemlee@mycodx.com`으로 테스트 배포합니다. 이 문서 작성 단계에서는 원격 설정이나 배포를 실행하지 않았습니다.
3. Vercel 주소의 `/api/forms` 응답에서 `careersEnabled:true`를 확인합니다. `enabled`는 기존 문의·메일 설정이므로 이 단계에서는 false일 수 있습니다.
4. 가상 지원서와 필수 3종 파일로 접수합니다. 지원자 화면은 저장 완료를 안내하고 접수번호는 표시하지 않아야 합니다.
5. Supabase Table Editor에서 `recruit_applications.stage=submitted`, 파일 행의 `storage_status=ready`, `sha256` 값, 알림 `pending`, 버킷 비공개 설정을 확인합니다. 저장 경로에 개인정보가 없는지도 확인합니다.
6. 기존 검증 SQL로 anon/authenticated 직접 접근 금지, RPC service_role 전용 권한을 재확인합니다. 이 API에 공개 목록 조회·다운로드 경로는 없습니다.
7. 선택한 SMTP 또는 Resend 인증정보와 테스트 수신 주소를 확인한 뒤 `MAIL_FORMS_ENABLED=true`로 다시 배포합니다. **새 가상 지원서**를 제출하여 알림 `accepted`와 실제 받은편지함의 원본 첨부를 확인합니다. 이전 `pending` 작업을 일괄 자동 발송하는 기능은 아직 없습니다.
8. 개발자 도구의 네트워크 끊김/응답 유실·중복 클릭을 시험합니다. 같은 요청의 DB 행과 알림 선점 횟수가 늘어나지 않아야 합니다. `uncertain` 알림은 받은편지함·제공자 기록을 확인하기 전 재전송하지 않습니다.

## 후속 단계와 운영 전 조건

- 관리자 Auth/API/UI, 승인 관리자 확인, 다운로드 URL과 감사 로그 연결은 다음 단계입니다.
- 24시간 지난 staging, 고아 Storage 파일, 보관기간 지난 지원서의 **Supabase 물리 삭제 작업은 아직 구현하지 않았습니다**. 현재 daily cron은 기존 Blob 임시 자료 정리만 수행합니다.
- 알림 pending 재처리와 오래된 sending 감시를 자동 실행하는 작업은 아직 없습니다. 현재 코드에서 같은 확정 세션을 재호출하면 pending 선점을 시도할 수 있지만, 브라우저의 상태 조회 자체는 메일을 보내지 않습니다.
- DB와 Storage 원본의 별도 암호화 백업, 삭제 이력, 보관기간 제한, 실제 복구 검증이 필요합니다. Supabase DB 백업에는 Storage 파일 원본이 포함되지 않습니다. 백업·복구 스케줄러는 이번에 실행하거나 구현하지 않았습니다.
- 테스트 데이터로 실제 RPC/Storage 권한과 업로드를 검증한 뒤 관리자·정리·백업 단계를 마치고 공개 채용 접수를 활성화합니다. 도메인 변경은 마지막 단계입니다.

## 로컬 검증 범위

`npm test`, `npm run lint`, `npm run build`로 문의 회귀, 저장 재시도, 동시 제출, 알림 실패, 비밀/경로 노출 방지, 브라우저 중복 방지를 검사합니다. Supabase REST/Storage와 발송은 테스트 대역이며 실제 계정의 권한·서비스 상태·메일 수신 성공을 증명하지 않습니다. 기존 SQL 테스트와 실제 배포 테스트를 구분합니다.

공식 근거: [Supabase API 키](https://supabase.com/docs/guides/getting-started/api-keys), [Storage 업로드와 덮어쓰기](https://supabase.com/docs/guides/storage/uploads/standard-uploads), [Vercel 함수 제한](https://vercel.com/docs/functions/limitations), [Supabase 백업](https://supabase.com/docs/guides/platform/backups).
