# Vercel · 비공개 업로드 · SMTP / Resend 설정

채용 DB 저장 기능이 추가되었습니다. 채용 활성화·Supabase 설정·현재 Vercel 주소 테스트는
[채용 저장 API 안내](recruit-storage-setup.md)를 우선 적용하세요. 아래 문서는 기존 메일 전송 계층의 설정과 검증 이력입니다.

## 현재 준비된 구성

기존 React/Vite 화면과 네 가지 언어를 유지합니다. 문의는 `info@mycodx.com`, 채용은
`jakim@mycodx.com`으로 발송합니다. 문의의 전송 기록과 발송 잠금은 비공개 Blob에 저장합니다.
채용은 Supabase에 지원서·파일·알림 상태를 저장하며 DB 접수와 메일 결과를 구분합니다.

자동 발송은 **이카운트 SMTP와 Resend API 두 가지를 준비**했습니다.
서버의 `MAIL_PROVIDER=smtp` 또는 `MAIL_PROVIDER=resend`로 하나만 선택하며, 화면과 첨부 업로드는 공통입니다.
방식을 선택하지 않으면 문의·메일 발송이 비활성화됩니다. 채용 DB 접수는 `RECRUIT_FORMS_ENABLED`로 따로 제어합니다.
이카운트 수신 메일함은 두 방식 모두 그대로 사용합니다.

2026-10-30 현재 Vercel CLI 로그인을 확인하고 프로젝트와 두 비공개 Blob 저장소를 생성·연결했습니다.
테스트용 저장소에서 6 MiB 직접 업로드 및 원본 일치, 비인증 읽기 거부, 업로드 토큰 경로 제한,
동시 발송 잠금 4건 중 1건만 성공하는 것을 확인했습니다. 테스트 파일은 검증 후 삭제했습니다.
기존 Resend 전환 시 로컬 테스트 15개, ESLint, `vercel build`가 통과했습니다.
Vercel 함수 빌드에서 발견한 TypeScript 확장자 문제는 루트 `tsconfig.json`의
`rewriteRelativeImportExtensions` 설정으로 수정했습니다. 생성된 JavaScript 함수를 직접 로드하여
기본 비활성 응답과 정리 API의 비인증 요청 거부도 확인했습니다. 메일 발송은 대역으로 검증했으며
실제 메일 수신, 브라우저 화면 검증 및 기존 운영 도메인 이전은 아직 완료하지 않았습니다.

SMTP / Resend 선택 기능 추가 후에는 로컬 테스트 **21개**, ESLint, `npm run build`,
`vercel build`가 통과했습니다. 빌드된 Vercel 함수의 모듈 로드·비활성 응답·정리 API 인증 거부도 확인했습니다.
두 발송 방식은 대역으로 검증했고, Nodemailer의 실제 MIME 생성은 외부 접속 없이 확인했습니다.
이번 변경은 로컬 코드와 문서에만 적용했으며 아직 커밋·Push·재배포하지 않았습니다.

### 첫 배포 확인

2026-10-30 사용자가 커밋 `22bd0ff`를 올리고 첫 배포를 완료했습니다.
배포 `dpl_2Gjp2yzCNWD9tFsf3rUiPn3EzFzJ`는 Vercel의 **Production / Ready** 상태이며,
대표 주소는 [mycodx-website.vercel.app](https://mycodx-website.vercel.app)입니다.
이 배포 환경 이름이 기존 `mycodx.com`의 DNS 이전을 뜻하는 것은 아닙니다.

- 홈페이지 `/`, 채용 `/careers/apply`, 지원서 DOCX 다운로드: HTTP 200 확인.
- `/api/forms`: HTTP 200, `enabled: false`, 총 10 MiB·10개 제한 응답 확인.
- 브라우저 연결 오류로 시각적 렌더링·클릭 동작은 아직 검증하지 못했습니다.
- Preview에 사용자 지정 테스트 수신함을 `MAIL_TEST_RECIPIENT`로 등록했습니다. Production 수신처는 변경하지 않았습니다.
- 공개 Vercel 대표 주소에서 API가 허용 출처 오류를 반환하는 것을 확인했습니다.
  기존 `mycodx.com`, `www.mycodx.com`은 유지하고 이 프로젝트의 Vercel 주소 3개를
  `FORM_ALLOWED_ORIGINS`에 추가했습니다. 새 환경변수는 다음 배포부터 적용됩니다.
- Resend 인증용 DNS 3개는 현재 공개 DNS에서 조회되지 않았으며, `RESEND_API_KEY`도 아직 등록되지 않았습니다.

다음 단계는 발송 방식 선택입니다. SMTP를 고르면 웹메일 외부연동과 비밀번호를,
Resend를 고르면 발신 도메인 인증과 API 키를 준비합니다. 선택 전에는 인증정보를 등록할 필요가 없습니다.
준비가 끝나면 Preview 접수를 활성화하여 별도 배포하고, Vercel 제공 주소에서 가상 문의와 채용 첨부의 실제 수신을 확인합니다.
현재 `MAIL_FORMS_ENABLED=false`를 유지하며 실제 테스트 메일은 아직 발송하지 않았습니다.
기존 운영 홈페이지의 도메인 이전은 이 검증이 모두 끝난 뒤 마지막 단계에서 진행합니다.

### 두 방식의 선택 기준

| 항목 | 이카운트 SMTP | Resend |
| --- | --- | --- |
| 선택값 | `MAIL_PROVIDER=smtp` | `MAIL_PROVIDER=resend` |
| 발신 주소 | `info@mycodx.com` — 로그인 계정과 동일 | `website@send.mycodx.com` — 인증된 발신 도메인 |
| 인증 | 기존 웹메일 계정의 비밀번호 | 발송 전용 API 키 |
| 추가 준비 | 웹메일의 메일클라이언트 사용 허용 | Resend 계정과 발신 도메인 DNS 인증 |
| 회사 메일 수신 | 문의 `info@mycodx.com`, 채용 `jakim@mycodx.com` | 동일 |
| 답장 대상 | 제출자가 입력한 이메일 (`Reply-To`) | 동일 |
| 첨부 | 검증한 원본을 Nodemailer로 첨부 | 검증한 원본을 Base64로 API에 전달 |
| 접수 확인 | SMTP의 최종 2xx 응답 및 수신 대상 확인 | API 성공 응답 및 접수 ID 확인 |

두 방식 모두 실제 받은편지함 도착은 별도 확인해야 합니다. 실패 시 다른 방식으로 자동 전환하지 않습니다.
기존 발송 잠금은 방식을 바꿔도 유지하므로 결과가 불확실한 접수를 다른 서비스로 자동 재발송하지 않습니다.

## 1. Vercel 프로젝트

[프로젝트 대시보드](https://vercel.com/myco-dx/mycodx-website): `MycoDx / mycodx-website`.
로컬 `.vercel/project.json`에 프로젝트 연결이 기록되어 있습니다. 이 파일과 환경변수는 Git에서 제외합니다.

GitHub 저장소는 `mycodx-dev/mycodx_website`이며 사용자가 Vercel의 Git 연결을 완료했습니다.
커밋 `22bd0ff`가 `main`에 반영되어 첫 배포가 완료되었습니다.
이후 코드 변경은 이 별도 저장소에 반영하며 원본 홈페이지 저장소를 수정하지 않습니다.

| 항목 | 값 |
| --- | --- |
| Framework | Vite |
| Root Directory | `.` |
| Install | `npm ci` |
| Build | `npm run build` |
| Output | `dist` |
| Node.js | `24.x` |
| Functions region | `icn1` (서울) |
| Fluid compute | `vercel.json`에서 `fluid: true`로 활성화 |
| Function duration | 180초 — Fluid compute 활성화 기준 |
| Cleanup Cron | `0 18 * * *` — 하루 1회, UTC 18시 / 한국시간 다음 날 03시 |
| Plan compatibility | Hobby의 기술 제한에 맞춤; 상업적 운영 허용 여부는 별도 |

[Cron 사용 제한](https://vercel.com/docs/cron-jobs/usage-and-pricing)에 맞춰 매시간 정리하던 작업을
하루 1회로 변경했습니다. Hobby에서는 한국시간 03:00~03:59 사이에 실행될 수 있으며,
정확한 실행 시각을 보장하지 않습니다. [함수 실행 시간](https://vercel.com/docs/functions/limitations)은
Fluid compute가 활성화된 Hobby 환경에서 최대 300초이므로 현재 180초 설정을 사용할 수 있습니다.
`vercel.json`에 `fluid: true`를 명시하여 배포 시 활성화합니다.

[Hobby](https://vercel.com/docs/plans/hobby)는 개인 비상업용으로 제한됩니다.
기술적으로 배포 가능한 설정과 회사 사이트의 운영 허용 여부는 다릅니다. MycoDx 회사 홈페이지를
무료로 운영하려면 상업적 사용을 허용하는 다른 무료 호스팅으로 전환해야 합니다.
현재 구성에 유료 플랜 가입이나 결제를 요구하는 단계를 넣지 않았으며,
유료 요금제 변경·결제·기존 운영 도메인 변경은 진행하지 않았습니다.

### 무료 플랜 사용량

2026-10-30 공식 요금 안내 기준입니다. 아래 한도는 계정·팀의 다른 프로젝트와 테스트 사용량도
함께 확인해야 하며, 현재 코드가 무료 한도 내의 접수 건수를 보장하는 것은 아닙니다.

| 서비스 | 무료 범위 | 한도에 도달했을 때 |
| --- | --- | --- |
| Vercel Hobby Cron | 작업별 하루 1회 | 더 자주 실행하는 설정은 배포 실패 |
| Vercel Blob | 월평균 저장량 1 GB, 월 Simple Operations 10,000회, Advanced Operations 2,000회, 전송량 10 GB | 추가 사용료를 청구하지 않고 Blob 접근이 중단될 수 있음 |
| Resend Free (선택 시) | 월 3,000통, 일 100통 | 한도 초과 발송 제한; 유료 전환·초과 과금 설정을 켜지 않음 |
| 이카운트 SMTP (선택 시) | 현재 사용 중인 웹메일 계정 이용; 추가 계정 생성 없음 | 사용 중인 웹메일의 발송량·첨부 한도를 확인 |

Blob은 첨부뿐 아니라 접수 정보·발송 잠금·요청 제한 기록도 저장하므로 **메일 1통당 작업 1회가 아닙니다**.
첨부가 없어도 저장소 작업이 발생합니다. Preview와 Production 저장소를 나누어도 무료 사용량이
각각 별도로 늘어나지는 않습니다. 업로드·목록 조회도 작업 횟수에 포함되며, 삭제는 무료입니다.
하루 1회 정리는 매시간 정리할 때보다 정기 조회 횟수를 줄이지만 접수량에 따른 사용량까지 제한하지는 않습니다.
폼의 시간당 요청 제한은 오남용 방지용이며 Resend의 일·월 발송 한도나 Blob의 월간 한도와는 별개입니다.

Vercel Usage와 선택한 발송 서비스의 사용량·제한을 확인합니다. 서비스 한도나 설정 문제로 접수가
실패하면 기존 직접 이메일 안내를 사용하며, 발송 결과가 불확실한 요청은 자동 재전송하지 않습니다.
문의·채용 담당자에게 각 1통만 발송하고 지원자 자동 회신은 추가하지 않은 구성입니다.

공식 자료: [Blob 요금·Hobby 한도](https://vercel.com/docs/vercel-blob/usage-and-pricing),
[Resend 요금](https://resend.com/pricing).

최초에는 `MAIL_FORMS_ENABLED=false`로 배포합니다. 화면은 열리고 폼에는 이메일 접수 안내가 표시됩니다.
웹사이트 DNS를 변경하기 전에 Vercel 제공 주소에서 확인합니다. 웹사이트의 A/CNAME만 이전하고
이카운트 메일용 MX 및 SPF/DKIM/DMARC 레코드는 보존합니다.

## 2. Private Blob 연결

이미 생성한 두 저장소는 모두 **Private**, 서울(`icn1`) 리전입니다.

| 저장소 | 연결 환경 |
| --- | --- |
| `mycodx-forms-preview` | Preview, Development |
| `mycodx-forms-production` | Production |

각 환경의 `BLOB_READ_WRITE_TOKEN` 연결을 완료했습니다. 같은 이름의 저장소를 다시 만들 필요가 없습니다.

파일 경로에는 지원자 이름이나 원본 파일명을 넣지 않고 임의 ID를 사용합니다.
브라우저에는 개별 파일 경로·최대 크기·형식·1시간 유효기간을 제한한 업로드 토큰만 전달합니다.
전체 저장소의 읽기/쓰기 토큰을 `VITE_` 변수로 만들거나 브라우저에 전달하면 안 됩니다.

저장소에는 `mycodx-forms-v1/` 아래 다음 항목이 생깁니다.

- `submissions/<날짜>/<제출 ID>/manifest.json`: 동의한 제출 내용과 파일 목록
- `files/<임의 ID>.<확장자>`: 각 제출 경로 아래의 비공개 원본 파일
- `dispatch.json`: 메일 발송을 시작한 불변 잠금
- `sent.json`: 선택한 발송 서비스가 접수한 메일 ID와 접수 시각
- `uncertain.json`: 발송 결과가 불확실한 기록
- `rate/`: 원본 IP를 저장하지 않는 요청 제한용 기록

## 3. 발송 방식별 설정

### A. 이카운트 SMTP

사용자가 `info@mycodx.com`은 로그인·발신 가능한 웹메일 계정임을 확인했습니다.
추가 계정 없이 이 계정으로 인증하고, 발신 주소와 SMTP envelope 발신자도 같은 계정으로 고정합니다.
기존 Resend용 `MAIL_FROM` 또는 `RESEND_FROM` 값은 SMTP 발신자에 영향을 주지 않습니다.

1. 이카운트 **웹메일**에 로그인합니다. ERP 공용메일 설정과 구분합니다.
2. 웹메일의 외부연동설정에서 **메일클라이언트 사용**을 허용합니다.
3. 외부연동 가이드에서 SMTP 서버·포트·인증 정보를 확인합니다. 현재 기본값은 `wsmtp.ecount.com`, 포트 `587`입니다.
4. [Vercel 환경변수](https://vercel.com/myco-dx/mycodx-website/settings/environment-variables)에서
   **Add Environment Variable**을 선택하여 `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER=info@mycodx.com`을 등록합니다.
5. 같은 화면에 Key `SMTP_PASS`, Value **웹메일 비밀번호**를 Secret/Sensitive로 등록합니다.
   첫 테스트는 **Preview만** 선택합니다. 비밀번호는 채팅·Git·`VITE_` 변수에 넣지 않습니다.
6. Preview에 `MAIL_PROVIDER=smtp`와 테스트 수신처를 지정한 다음 아래 배포 검증 절차를 따릅니다.

기본 포트 587은 STARTTLS를 필수로 사용하고 TLS 인증서를 검증합니다. 메일 제공자가 465를 안내하면
`SMTP_PORT=465`로 설정하여 연결 시작부터 TLS를 사용합니다. 비암호화 포트 25는 허용하지 않습니다.
DNS·연결·인사 응답·소켓 유휴 시간 제한을 설정하고, 함수는 SMTP 최종 응답을 기다린 뒤 결과를 반환합니다.
SMTP 서버가 메일을 받은 직후 연결이 끊겨 결과가 불확실해지면 자동 재전송하지 않습니다.

이 방식은 Resend 가입·API 키·Resend용 DNS 인증을 요구하지 않습니다.
첨부 크기 및 자동 발송 허용 여부는 해당 웹메일 계정의 설정과 한도를 확인합니다.
SMTP 접수 자체는 웹메일의 보낸메일함에 사본을 저장하는 IMAP 작업과 다르므로,
보낸메일함 목록만으로 성공 여부를 판단하지 말고 실제 테스트 수신함과 접수 기록을 확인합니다.

### B. Resend 발신 도메인 및 API 키

이 절차는 Resend를 선택한 경우에만 진행합니다. 웹메일 비밀번호는 필요하지 않습니다.

발신 주소는 사용자가 확인한 Resend 등록 도메인에 맞춰 `website@send.mycodx.com`으로 설정했습니다. 실제 수신 메일함을 새로 만들 필요는 없지만
Resend 계정과 도메인 인증은 필요합니다. 수신 주소는 문의 `info@mycodx.com`, 채용 `jakim@mycodx.com`입니다.

1. [Resend Domains](https://resend.com/domains)에 이미 추가한 `send.mycodx.com`을 사용합니다.
2. 표시된 DNS 레코드의 종류·이름·값을 그대로 등록합니다. 공개 NS 조회 결과 현재 DNS는 가비아에서 관리합니다.
3. 발신 인증용 TXT/MX 또는 CNAME 레코드의 이름을 확인해 해당 하위 도메인에만 추가합니다.
   기존 `mycodx.com`의 이카운트 수신용 MX나 SPF/DKIM 레코드를 교체하지 않습니다.
4. Resend에서 도메인이 Verified 상태가 되는지 확인합니다. Resend의 메일 수신 기능을 켤 필요는 없습니다.
5. [API Keys](https://resend.com/api-keys)에서 **Sending access**, 가능하면 위 도메인에 한정한 키를 만듭니다.
6. [Vercel 환경변수](https://vercel.com/myco-dx/mycodx-website/settings/environment-variables)에
   `RESEND_API_KEY`를 Secret으로 등록합니다. 키는 채팅·Git·`VITE_` 변수에 넣지 않습니다.
   첫 테스트에는 Preview에만 등록합니다. 운영 준비 시 Production에 별도 키를 등록합니다.
7. Preview에 `MAIL_PROVIDER=resend`, `RESEND_FROM=website@send.mycodx.com`과 테스트 수신처를 지정합니다.

#### 확인된 DNS 등록값 (Resend 선택 시)

사용자가 Resend 화면에서 도메인 `send.mycodx.com`과 CNAME 타입을 확인했습니다.
가비아 DNS 관리툴에서 **`mycodx.com` 영역**에 다음 레코드를 추가합니다.
호스트 입력란에는 `mycodx.com`을 다시 붙이지 않습니다. CNAME 값 끝의 마침표는 가비아 입력 형식입니다.

| 타입 | 호스트 | 값/위치 |
| --- | --- | --- |
| TXT | `resend._domainkey.send` | 아래 DKIM 공개키 전체 |
| CNAME | `rsend.send` | `rsend-apne1.forge.rmta.net.` |
| CNAME | `send.send` | `send.forge.rmta.net.` |

```text
p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC3CP/VdP+kxRg5vnVIXS+R5cis8DzwfcKxb21aoanj4f7bLFaqmzOe5RL3rtG+fzL2Fc34WnZZSgIL/sHFcteOFL6ovC1pw9+iVkqRZcin8o6E9DY0TCmNjL55F5ORtefpJfnRCkdXl3MraXvlCBXNKFn/Vn1TubCVw6/Q3GwWhQIDAQAB
```

이 값은 DNS에 공개하는 DKIM 공개키이며 Resend API 키와 다릅니다.
TTL은 가비아 기본값을 사용합니다. CNAME에는 MX 우선순위를 입력하지 않습니다.
기존 루트 MX `mycodx.com → wmx.ecount.com`(우선순위 10)은 유지합니다.
가비아에 저장한 뒤 Resend 도메인 화면에서 Verify를 실행하고 Verified 상태를 확인합니다.
2026-10-30 조회 시점에는 위 세 레코드가 공개 DNS에서 조회되지 않았습니다.

[가비아 DNS 등록 안내](https://customer.gabia.com/faq/detail/287/1201)

Resend API는 검증한 원본 파일을 Base64로 받아 첨부합니다. 브라우저에는 API 키를 전달하지 않습니다.
`Reply-To`는 제출자가 입력한 이메일이므로 담당자가 받은 메일에 답장하면 제출자에게 회신합니다.

### 두 방식의 공통 첨부 처리

현재 첨부 제한은 기존과 동일한 총 **10 MiB**, 최대 10개입니다. 서버가 전부 읽어 크기와
파일 시그니처를 확인한 뒤 발송하며, 원본 파일 크기의 합계를 10 MiB로 제한합니다.
메일 인코딩 후 크기는 원본보다 커집니다. 선택한 발송 서비스와 수신 메일함에서 전체 첨부가 수신되는지 확인합니다.
확장자·시그니처 검증은 악성코드 검사와 동일하지 않으며 압축파일은 서버에서 해제하지 않습니다.

## 4. 환경변수

Vercel Project → Settings → Environment Variables에 등록합니다. 비밀값을 채팅이나 Git에 넣지 않습니다.
환경변수 변경 후에는 해당 환경을 다시 배포해야 합니다.

| 변수 | 값/용도 |
| --- | --- |
| `MAIL_FORMS_ENABLED` | 초기 `false`; Preview 테스트 시에만 해당 환경을 `true`, 운영은 검증 후 활성화 |
| `MAIL_PROVIDER` | 초기 미설정; `smtp` 또는 `resend` 중 하나. 미설정·잘못된 값이면 접수 비활성화 |
| `FORM_ALLOWED_ORIGINS` | 기존 `mycodx.com`, `www.mycodx.com`과 이 프로젝트의 Vercel 대표·고정 주소; 현재 목록은 `.env.example` 참고 |
| `FORM_SIGNING_SECRET` | 32자 이상의 무작위 비밀값 |
| `CRON_SECRET` | 위 값과 다른 32자 이상의 무작위 비밀값 |
| `BLOB_READ_WRITE_TOKEN` | 해당 환경의 **Private** Blob 연결 토큰 |
| `SMTP_HOST` | SMTP 선택 시 `wsmtp.ecount.com`; 웹메일 외부연동 가이드와 대조 |
| `SMTP_PORT` | SMTP 선택 시 기본 `587` (STARTTLS 필수); `465` (TLS)도 지원 |
| `SMTP_USER` | SMTP 선택 시 `info@mycodx.com`; 인증 계정이자 발신 주소 |
| `SMTP_PASS` | SMTP 선택 시 웹메일 비밀번호; Secret/Sensitive로 저장 |
| `RESEND_API_KEY` | Resend 선택 시 발송 전용 API 키; Secret/Sensitive로 저장 |
| `RESEND_FROM` | Resend 선택 시 `website@send.mycodx.com`; 도메인 인증 필요 |
| `CONTACT_TO` | `info@mycodx.com` |
| `CAREERS_TO` | `jakim@mycodx.com` |
| `MAIL_TEST_RECIPIENT` | Preview에서는 테스트 수신 계정; Production에서는 비움 |

`VERCEL_URL`의 해당 배포 출처는 서버에서 자동 허용합니다. 고정 Preview alias는
`FORM_ALLOWED_ORIGINS`에 직접 추가합니다. 테스트 발신 제목에는 `[TEST]`가 붙습니다.
Preview에서는 `MAIL_TEST_RECIPIENT`가 없으면 폼이 활성화되지 않습니다.
`FORM_SIGNING_SECRET`, `CRON_SECRET`은 Production과 Preview별로 서로 다른 무작위 값으로 등록했습니다.
기본 수신 주소·허용 출처·기존 Resend용 `MAIL_FROM`·`MAIL_FORMS_ENABLED=false`도 등록했습니다.
사용자가 지정한 테스트 수신 주소는 Preview의 `MAIL_TEST_RECIPIENT`에 등록했습니다.
Preview와 Production의 비밀값·저장소를 분리하면 테스트 접수와 운영 접수가 섞이지 않습니다.

선택한 방식의 변수만 필수이며, 다른 방식의 인증정보가 없어도 동작합니다.
기존 `MAIL_FROM`은 Resend에서 `RESEND_FROM`이 없을 때만 사용하는 호환용 값입니다.
새 설정에는 `RESEND_FROM`을 사용합니다. SMTP는 항상 `SMTP_USER`로 발신합니다.
`.env.example`은 선택값과 비밀번호·API 키를 비운 예시입니다. 이 파일의 변경만으로 Vercel 설정은 바뀌지 않습니다.
이번 두 방식 준비 작업에서는 클라우드 환경변수나 배포 상태를 변경하지 않았습니다.

공통 변수가 Production·Preview·Development에 함께 적용되는 경우, CLI의 `env update --environment preview`도
그 변수의 모든 환경 값을 변경합니다. Preview만 활성화할 때는 환경별 변수를 분리하거나
Preview의 대상 Git 브랜치에 한정한 변수를 추가하여 Production의 `MAIL_FORMS_ENABLED=false`를 보존합니다.

## 5. 실제 배포 검증

1. Preview 저장소·변수를 연결하고 `MAIL_PROVIDER` 및 해당 인증정보, 테스트 수신 계정을 지정합니다.
2. Preview에 `MAIL_FORMS_ENABLED=true`를 설정한 뒤 재배포합니다.
3. `/api/forms`가 JSON을 반환하고 `/careers/apply` 새로고침이 동작하는지 확인합니다.
4. 가상 이름과 테스트 문서로 문의·채용을 각각 제출합니다. 실제 개인정보는 테스트에 사용하지 않습니다.
5. 같은 이름의 PDF 2개, 한국어 파일명, 4.5 MiB 초과 파일을 포함해 전체 10 MiB 이내로 확인합니다.
6. 담당 메일함에서 본문, Reply-To, 첨부 개수, 원본 파일 내용을 전부 확인합니다.
7. 제출 버튼 중복 클릭, 업로드 중 네트워크 실패, 응답 유실 시 중복 메일이 생기지 않는지 확인합니다.
8. Cron은 Production 배포에서만 자동 실행됩니다. Preview는 테스트 저장소를 대상으로 정리 API를 인증 호출하여 검증하고, 운영 배포를 진행할 경우 Cron 로그에서도 `/api/forms?action=cleanup` 결과를 확인합니다.
9. 두 방식을 비교할 경우 같은 Preview에서 접수를 비활성화한 뒤 방식을 변경하고 재배포하여 **새 테스트 접수**로 확인합니다. 기존 발송 잠금을 지우지 않습니다.
10. 방식을 확정하고 수신 검증을 마치면 Production 변수에 테스트 수신 주소가 없는지 확인하고 운영 환경을 활성화합니다. 기존 `mycodx.com` 웹사이트 도메인 이전은 마지막에 별도로 진행합니다.

SMTP 또는 Resend의 접수 응답은 실제 받은편지함 배치나 열람을 보장하지 않습니다. 발송 결과가 불확실하면
자동 재전송하지 않습니다. 제출 ID로 `sent.json`/`uncertain.json`과 담당자 수신함을 함께 확인합니다.
브라우저는 제출 직전 해당 탭의 sessionStorage에 개인정보 없는 제출 토큰을 저장합니다.
같은 탭에서 다시 제출하면 새 메일 대신 기존 제출 상태를 확인합니다.
두 방식 모두 같은 Blob 발송 잠금을 사용합니다. Resend에는 제출 ID를 `Idempotency-Key`로 보내
추가 중복 방지를 적용합니다. SMTP의 고정 `Message-ID`는 추적용이며, 메일 서버의 중복 제거를 보장하지 않습니다.

## 6. 보관 및 장애 대응

`vercel.json`의 일일 Cron은 Vercel이 `CRON_SECRET`을 사용해 호출합니다.
UTC 18시(한국시간 다음 날 03시)로 예약되어 있으며, Hobby에서는 해당 시간대 안에서 실행 시각이 달라질 수 있습니다.
제출 내용·원본 파일·발송 기록은 각 객체 업로드 후 7일이 지난 다음 일일 정리에서 삭제합니다.
정확히 7일째 삭제되는 것은 아니며 다음 일일 작업까지 대기 시간이 추가됩니다.
요청 제한 기록은 2시간이 지난 다음 일일 정리에서 삭제합니다. 시간별 요청 제한 계산에는 영향을 주지 않습니다.
성공·실패·중단된 업로드 모두 정리 대상입니다.
정리 API는 이 기능이 소유한 `mycodx-forms-v1/` 경로만 삭제합니다.
Cron이 실패하면 보관기간이 늘어날 수 있으므로 Vercel 로그/알림으로 확인합니다.
Preview에는 자동 Cron이 없으므로 테스트 저장소의 정리 API를 인증 호출하여 별도로 정리합니다.
담당자 메일함에 전달된 자료는 기존 채용 동의서의 보유기간에 따라 별도로 관리합니다.
Blob 정리로 SMTP·Resend의 발송 기록이나 메일함의 사본까지 삭제되지는 않습니다.
선택한 발송 서비스의 메시지·첨부 보관 설정은 별도로 확인해 회사의 개인정보 보관 정책에 맞춥니다.

접수 중단은 `MAIL_FORMS_ENABLED=false`로 설정하고 재배포합니다. 사이트 화면과 직접 이메일
안내는 유지됩니다. SMTP·Resend 응답 유실 이후에는 담당자가 수신 여부를 확인하기 전 발송 잠금을
삭제하거나 새 제출을 요구하지 않습니다.

동일 IP는 시간당 5회, 사이트 전체는 시간당 100회 신규 제출 세션을 허용합니다.
이 제한은 Blob의 덮어쓰기 금지 기록으로 유지하며 함수 재시작에도 보존됩니다.
추가 트래픽 방어가 필요하면 Vercel Firewall에서 `/api/forms` 요청 제한을 설정합니다.

## 배포 전 남은 의존성 점검

현재 잠금 파일에서 `npm audit --omit=dev`는 high 4개, moderate 2개 패키지를 보고합니다.
이는 서로 독립적인 취약점 6개라는 뜻은 아니며 전이 의존성의 상위 패키지까지 포함한 수입니다.

- `@vercel/blob → @vercel/oidc → @vercel/cli-config → zod`: 제약이 있는 대형 컬렉션 검증의 메모리 소진 경고입니다.
  현재 코드는 Blob 토큰을 명시적으로 전달하고, 폼 입력은 24 KiB로 제한하여 자체 검증합니다.
  설치된 CLI 설정 라이브러리는 Zod를 번들에도 포함하므로 단순 `overrides`로 진단 숫자만 없애지 않았습니다.
- `react-router-dom → react-router`: 리디렉션 및 SSR hydration 경고가 남아 있습니다.
  `react-router-dom`은 동일 메이저의 `6.30.6`으로 올려 해당 버전의 별도 수정 사항을 반영했습니다.
  현재 앱은 브라우저 렌더링이며 SSR hydration을 사용하지 않습니다. 남은 경고를 해소하려면
  메이저 업그레이드와 경로·화면 회귀 검증이 필요합니다.

위 내용은 코드 경로 검토이며 취약점 미영향을 보증하는 결과가 아닙니다. 운영 활성화 전에
진단을 다시 실행하고, 상위 패키지 수정 버전 또는 검증된 의존성 교체를 적용해야 합니다.
`npm audit fix --force`로 Blob SDK를 자동 하향하거나 라우터 메이저 버전을 무검증 교체하지 않습니다.

## 공식 문서

- [이카운트 — 홈페이지 문의의 SMTP 자동 발송](https://www.ecount.com/kr/ecount/service/faq-view?category=groupware&page=3&record_sid=8717NHUEVUN7MFH)
- [이카운트 — 웹메일 외부연동 설정](https://www.ecount.com/kr/ecount/service/faq-view?page=77&record_sid=86HFPBH6T6427ML)
- [Nodemailer SMTP 및 TLS 설정](https://nodemailer.com/smtp)
- [Vercel Functions와 SMTP](https://vercel.com/kb/guide/serverless-functions-and-smtp)
- [Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js)
- [Vercel Blob 직접 업로드](https://vercel.com/docs/vercel-blob/client-upload)
- [Vercel Blob 비공개 저장소](https://vercel.com/docs/vercel-blob/private-storage)
- [Resend 도메인 인증](https://resend.com/docs/dashboard/domains/introduction)
- [Resend 발신 주소와 메일함](https://resend.com/docs/knowledge-base/how-do-I-create-an-email-address-or-sender-in-resend)
- [기존 MX와 충돌 방지](https://resend.com/docs/knowledge-base/how-do-i-avoid-conflicting-with-my-mx-records)
- [Resend 첨부파일](https://resend.com/docs/dashboard/emails/attachments)
- [Resend 중복 방지 키](https://resend.com/docs/dashboard/emails/idempotency-keys)
