# 문의·채용 실제 메일 테스트 점검 — 2026-11-04

## 확인된 현재 상태

2026-11-04 Vercel 연결 후 `https://mycodx-website.vercel.app/api/forms`에서 직접 확인한 응답:

```json
{"enabled":true,"careersEnabled":true,"maxTotalBytes":10485760,"maxFiles":10}
```

- 문의·채용 기능의 설정 검사는 활성 상태입니다. 이전 `enabled:false` 상태에서 메일 환경변수가 추가된 뒤 바뀌었습니다.
- 채용 저장용 환경변수의 **형식 검사**는 통과했습니다. 이 응답은 실제 Supabase 로그인·RPC·Storage 저장 성공을 검증하지 않습니다.
- 현재 코드에서 채용 버튼은 `careersEnabled`가 true이고 파일 오류·제출 진행 중 상태가 없으면 활성화됩니다. 문의의 `enabled:false` 때문에 채용까지 함께 잠그지 않습니다.
- 두 기능이 공유하는 Blob 토큰 존재 여부, 서명/정리 비밀 길이, 출처 설정 존재 여부, 채용 수신 주소 형식은 통과한 상태입니다. 이 값들을 새로 만들거나 교체할 필요는 없습니다.
- Vercel에서 `SMTP_USER`, `SMTP_PASS`, `MAIL_PROVIDER`의 Production 등록과 `MAIL_TEST_RECIPIENT`의 Production·Preview 등록을 확인했습니다. 환경변수 값은 복호화하지 않았습니다.
- 채용 제출은 14:29~14:30(KST)에 `POST /api/forms`에서 503으로 실패했습니다. 당시 배포는 `dpl_5CspVzmcwhi3k7zYX3yLcpmQepo4`이고 기존 로그는 `forms_service_error`만 남겨 원인을 특정할 수 없습니다.
- Production Blob 저장소 `mycodx-forms-production`은 비공개·available이며 사용량 초과가 아닙니다. 이것만으로 실제 파일 업로드·읽기 성공을 보장하지는 않습니다.

## 웹에서 직접 진행할 작업

### 1. 정확한 배포 환경 선택

Vercel 대시보드 → `mycodx-website` → **Deployments**에서 실제 접속한 배포의 환경과 커밋을 확인합니다. `vercel.app` 주소라도 Production일 수 있습니다.

**Settings → Environment Variables**에서 그 환경을 선택합니다. 아래 표의 키가 이미 있으면 Edit, 없으면 Add로 입력합니다. 모든 값은 따옴표 없이 입력합니다. 환경변수 파일을 Git에 올리는 것으로는 Vercel 설정이 바뀌지 않습니다.

### 2. 공통 테스트 설정

| Key | Value | Type |
| --- | --- | --- |
| `MAIL_FORMS_ENABLED` | `true` | Config |
| `RECRUIT_FORMS_ENABLED` | `true` — 현재 검사 통과 상태 유지 | Config |
| `MAIL_TEST_RECIPIENT` | `mycodx206@gmail.com` | Config |
| `CONTACT_TO` | `info@mycodx.com` — 미등록 시 코드 기본값 | Config |
| `CAREERS_TO` | `jakim@mycodx.com` — 미등록 시 코드 기본값 | Config |

테스트 수신 주소를 지정하면 새 문의와 새 채용 알림은 모두 Gmail 한 곳으로 갑니다. 발신 주소는 선택한 SMTP/Resend 설정을 사용합니다. Gmail 수신만을 위해 Gmail 비밀번호나 Gmail SMTP 설정을 등록할 필요는 없습니다.

`FORM_ALLOWED_ORIGINS`에는 **실제 테스트 페이지의 출처**가 포함되어야 합니다. 예: `https://mycodx-website.vercel.app`. 경로나 마지막 `/` 없이 기존 목록에 쉼표로 추가합니다. GET 상태 조회는 Origin을 검사하지 않으므로, `enabled:true`라도 잘못된 출처로 POST하면 거절될 수 있습니다. 자동 추가되는 `VERCEL_URL`은 개별 배포 주소이므로 대표 별칭 주소도 확인합니다.

### 3-A. 이카운트 SMTP로 시험할 경우

기존 `info@mycodx.com` 계정으로 로그인·발신 가능하다고 확인했으므로, 해당 웹메일 비밀번호를 관리할 수 있으면 이 방식으로 먼저 시험할 수 있습니다. `MAIL_PROVIDER`가 이미 `resend`로 지정되어 있다면 준비된 Resend 상태를 먼저 확인하고, 의도적으로 전환할 때만 값을 바꿉니다.

| Key | Value | Type |
| --- | --- | --- |
| `MAIL_PROVIDER` | `smtp` | Config |
| `SMTP_HOST` | `wsmtp.ecount.com` | Config |
| `SMTP_PORT` | `587` | Config |
| `SMTP_USER` | `info@mycodx.com` | Config |
| `SMTP_PASS` | 해당 웹메일의 실제 비밀번호 | Secret |

이카운트 **웹메일** 로그인 → 우측 상단 프로필 → 개인기능설정 → 외부연동설정 → **메일클라이언트 사용**을 허용합니다. 외부연동가이드에서 해당 계정의 서버·포트도 확인합니다. 코드는 587에서 STARTTLS, 465에서 TLS를 사용하며 암호화·인증서 검증을 끄지 않습니다. [이카운트 공식 연동 안내](https://www.ecount.com/kr/ecount/service/faq-view?page=77&record_sid=86HFPBH6T6427ML), [서버값 확인](https://www.ecount.com/kr/ecount/service/faq-view?page=19&record_sid=8717NN4J8UK7MBA).

SMTP를 선택했다면 Resend 키와 발신 도메인 인증은 이 테스트에 필요하지 않습니다. 비밀번호는 채팅이나 Git에 넣지 않고 Vercel Secret 입력란에 직접 등록합니다.

### 3-B. Resend로 시험할 경우

| Key | Value | Type |
| --- | --- | --- |
| `MAIL_PROVIDER` | `resend` | Config |
| `RESEND_API_KEY` | 발송 권한이 있는 실제 Resend API 키 | Secret |
| `RESEND_FROM` | `website@send.mycodx.com` | Config |

[Resend Domains](https://resend.com/domains)에서 `send.mycodx.com`이 **Verified**인지 확인합니다. 기존 안내가 있었다는 사실만으로 현재 인증 완료를 가정하지 않습니다. [API Keys](https://resend.com/api-keys)에서 해당 도메인에 발송할 수 있는 키를 준비하고 Secret으로 등록합니다. `RESEND_FROM`이 없으면 기존 `MAIL_FROM` 값을 사용하는 호환 동작도 유지되어 있습니다.

발신 도메인 인증이 미완료라면 그 상태에서 실제 발송은 실패합니다. 이번 점검에서는 DNS를 변경하지 않았습니다. 홈페이지 도메인을 Vercel로 옮기는 작업은 메일 테스트에 필요하지 않습니다. [Resend 도메인 안내](https://resend.com/docs/dashboard/domains/introduction), [API 키 안내](https://resend.com/docs/dashboard/api-keys/introduction).

### 4. 저장 후 배포

환경변수는 Save만으로 기존 배포에 반영되지 않습니다. 수정 코드까지 커밋·push하여 자동 배포하거나, 코드가 이미 반영되었다면 대상 환경으로 Redeploy합니다. **Ready 상태와 배포 커밋**을 확인합니다. [Vercel 환경변수 적용 안내](https://vercel.com/docs/environment-variables/managing-environment-variables).

### 5. 버튼과 실제 수신 확인

1. 같은 배포 주소의 `/api/forms`를 열어 `enabled:true`, `careersEnabled:true`를 확인합니다. 여기까지는 형식 검사이며 실제 메일 인증·수신 성공은 다음 단계에서 확인합니다.
2. 홈페이지로 돌아옵니다. 이전 배포의 화면을 계속 열어둔 경우 입력 내용을 보존한 뒤 새로 열어 최신 코드를 사용합니다.
3. 가상 이름·테스트 내용으로 **새 문의**를 제출합니다. Gmail 받은편지함과 스팸함을 확인합니다.
4. 필수 3종 테스트 파일을 넣어 **새 채용지원서**를 제출합니다. 총 10 MiB·10개 제한을 지킵니다. Gmail에서 첨부파일이 정상인지 확인합니다.
5. Supabase에서 지원서 `submitted`, 파일 `ready`, 알림 `accepted` 여부를 확인합니다. `accepted`는 발송 서비스의 접수이며 Gmail 실제 수신은 별도입니다.
6. 이전에 저장만 해서 `pending`인 작업은 자동 일괄 발송되지 않습니다. 결과 불확실 상태의 지원서를 다른 제공자로 임의 재전송하지 않습니다.

## 코드에서 보완한 내용

메일 전송·Supabase 저장 코드를 새로 만들 필요는 없으며 기존 구현을 유지합니다. 버튼 문제와 설정 진단을 위해 다음을 보완했습니다.

- `server/config.ts`: 기존 활성화 조건을 유지하면서 누락·형식 오류의 변수 이름을 수집합니다. 검사와 진단이 같은 조건을 사용합니다.
- `server/configDiagnostics.ts`, `api/forms.ts`: GET 상태 조회 시 서버 로그에 `forms_configuration` 진단을 기록합니다. 제공자는 `smtp`/`resend`/null만 기록하고, 주소·키·비밀번호·입력 원문은 기록하지 않습니다. 같은 함수 인스턴스의 동일 보고는 반복 기록하지 않습니다. 공개 API 응답에는 진단 내용을 넣지 않습니다.
- `src/services/formAvailability.ts`, `src/hooks/useFormAvailability.ts`: 창으로 복귀, 탭 표시, 네트워크 복구 시 상태를 다시 조회합니다. 과거 요청이 늦게 도착해 최신 활성 상태를 덮어쓰는 것도 막습니다. 입력값을 초기화하지 않습니다.
- 기존 홈페이지 레이아웃, SMTP/Resend 발송 어댑터, Supabase SQL, `vercel.json`, 운영 DNS는 변경하지 않았습니다.

## 비활성화 원인 로그 확인

**이번 수정 코드가 배포된 뒤** `/api/forms`를 한 번 열고 Vercel 프로젝트 **Logs**에서 `forms_configuration`을 검색합니다. 해당 배포 환경·시간 범위로 필터링합니다. 로그가 안 보이면 배포 커밋과 조회 시간을 먼저 확인합니다. [Vercel Runtime Logs](https://vercel.com/docs/logs/runtime).

예시는 **가상 진단**이며 현재 원격 설정의 확인 결과가 아닙니다.

```json
{
  "event": "forms_configuration",
  "enabled": false,
  "careersEnabled": true,
  "mailProvider": "smtp",
  "testRecipientConfigured": true,
  "mailIssues": ["SMTP_PASS: required; remove line breaks"],
  "careersIssues": []
}
```

`mailIssues`에 나온 항목만 수정합니다. 위 예에서는 SMTP 비밀번호 입력과 Redeploy가 필요합니다. 등록된 Secret은 다시 읽을 수 없어도, 이 로그에서는 비어 있는지 또는 형식 오류가 있는지를 확인할 수 있습니다. **키·비밀번호의 진위나 실제 발송 서비스 권한은 이 로그로 검증하지 않습니다.**

## 검증 범위와 남은 확인

설정 진단·화면 복구·서비스 오류 진단과 기존 SMTP/Resend·저장 테스트를 합쳐 49개 테스트를 통과했습니다. 실제 Vercel 설정 메타데이터·공개 API·런타임 오류·Blob 저장소 상태를 조회했습니다. 비밀값 복호화, 원격 설정 변경, 배포, 실제 메일 발송은 수행하지 않았습니다. 코드 변경은 로컬 작업이며 push·배포가 필요합니다. 관리자 화면, 자동 삭제, 백업 구현은 기존 계획의 별도 후속 단계입니다.

## 채용 503 오류의 다음 진단

`server/serviceDiagnostics.ts`와 `server/forms.ts`, `server/storage.ts`, `server/supabase.ts`의 변경이 배포되어야 합니다. 외부 저장소 오류를 기존 공개 응답 `{ "error": "UNAVAILABLE" }`로 유지하면서 서버 로그에 실패한 서비스·작업, 허용 목록의 네트워크/DB 코드와 HTTP 상태만 남깁니다. URL·파일 경로·지원자 입력·비밀번호·키·원본 오류 메시지·스택은 기록하지 않습니다.

배포가 Ready가 된 뒤 같은 채용 제출을 한 번 재시도하고 Vercel Logs에서 `forms_service_error`를 확인합니다. 결과 불확실 지원서의 브라우저 저장 상태를 지우거나 DB를 삭제하지 않습니다. 재시도는 기존 중복 방지 키와 서명 토큰을 유지합니다.

아래는 **예시 해석이며 실제 발생 원인으로 확정된 내용이 아닙니다**.

| 로그 항목 | 확인할 대상 |
| --- | --- |
| `service: supabase`, `reason: ENOTFOUND` | Supabase URL 오타, 해당 프로젝트 호스트의 DNS·프로젝트 상태 |
| `service: supabase`, `httpStatus: 401` | 해당 프로젝트와 Secret Key의 일치·유효 여부 |
| `providerCode: PGRST202` | 해당 RPC 존재 여부·인수·스키마 캐시 |
| `providerCode: 42501` | 적용한 SQL의 함수 실행 및 객체 권한; RLS를 임의로 끄지 않음 |
| `operation: storage_download` | 비공개 버킷 접근 및 앞선 파일 저장 성공 여부 |
| `service: blob` | `operation`에 표시된 JSON 저장·파일 읽기·업로드 권한 발급 단계 |

현재 변경은 원인을 확인하기 위한 진단 보완입니다. 실제 503 원인 해결이나 채용 접수 성공을 검증한 것으로 간주하지 않습니다.
