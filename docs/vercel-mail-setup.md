# Vercel · 비공개 업로드 · Resend 설정

## 현재 준비된 구성

기존 React/Vite 화면과 네 가지 언어를 유지합니다. 문의는 `info@mycodx.com`, 채용은
`jakim@mycodx.com`으로 발송합니다. 별도 DB를 추가하지 않고, 전송용 기록과 발송 잠금을
비공개 Blob에 함께 저장합니다. 파일 업로드와 메일 발송 결과는 구분합니다.

자동 발송은 Resend API를 사용하며 이카운트는 기존 수신 메일함으로 유지합니다.
추가 이카운트 계정이나 웹메일 비밀번호는 필요하지 않습니다.

2026-10-30 현재 Vercel CLI 로그인을 확인하고 프로젝트와 두 비공개 Blob 저장소를 생성·연결했습니다.
테스트용 저장소에서 6 MiB 직접 업로드 및 원본 일치, 비인증 읽기 거부, 업로드 토큰 경로 제한,
동시 발송 잠금 4건 중 1건만 성공하는 것을 확인했습니다. 테스트 파일은 검증 후 삭제했습니다.
Resend 전환 후 로컬 테스트 15개, ESLint, `vercel build`가 통과했습니다.
Vercel 함수 빌드에서 발견한 TypeScript 확장자 문제는 루트 `tsconfig.json`의
`rewriteRelativeImportExtensions` 설정으로 수정했습니다. 생성된 JavaScript 함수를 직접 로드하여
기본 비활성 응답과 정리 API의 비인증 요청 거부도 확인했습니다. 메일 발송은 대역으로 검증했으며
실제 메일 수신, 브라우저 화면 검증, 도메인 이전 및 운영 배포는 아직 완료하지 않았습니다.

## 1. Vercel 프로젝트

[프로젝트 대시보드](https://vercel.com/myco-dx/mycodx-website): `MycoDx / mycodx-website`.
로컬 `.vercel/project.json`에 프로젝트 연결이 기록되어 있습니다. 이 파일과 환경변수는 Git에서 제외합니다.

GitHub 저장소는 `mycodx-dev/mycodx_website`입니다. 자동 연결 시 Vercel 계정에 GitHub Login Connection이
없다는 오류가 발생했습니다. Vercel 계정 설정에서 GitHub 연결 후 프로젝트의 Git 설정에서 저장소를 연결합니다.
현재 소스는 아직 커밋·Push하지 않았으므로, Git 자동 배포에는 소스 반영도 필요합니다.

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
실제 요금제 변경·결제·배포·운영 도메인 변경은 진행하지 않았습니다.

### 무료 플랜 사용량

2026-10-30 공식 요금 안내 기준입니다. 아래 한도는 계정·팀의 다른 프로젝트와 테스트 사용량도
함께 확인해야 하며, 현재 코드가 무료 한도 내의 접수 건수를 보장하는 것은 아닙니다.

| 서비스 | 무료 범위 | 한도에 도달했을 때 |
| --- | --- | --- |
| Vercel Hobby Cron | 작업별 하루 1회 | 더 자주 실행하는 설정은 배포 실패 |
| Vercel Blob | 월평균 저장량 1 GB, 월 Simple Operations 10,000회, Advanced Operations 2,000회, 전송량 10 GB | 추가 사용료를 청구하지 않고 Blob 접근이 중단될 수 있음 |
| Resend Free | 월 3,000통, 일 100통 | 한도 초과 발송 제한; 유료 전환·초과 과금 설정을 켜지 않음 |

Blob은 첨부뿐 아니라 접수 정보·발송 잠금·요청 제한 기록도 저장하므로 **메일 1통당 작업 1회가 아닙니다**.
첨부가 없어도 저장소 작업이 발생합니다. Preview와 Production 저장소를 나누어도 무료 사용량이
각각 별도로 늘어나지는 않습니다. 업로드·목록 조회도 작업 횟수에 포함되며, 삭제는 무료입니다.
하루 1회 정리는 매시간 정리할 때보다 정기 조회 횟수를 줄이지만 접수량에 따른 사용량까지 제한하지는 않습니다.
폼의 시간당 요청 제한은 오남용 방지용이며 Resend의 일·월 발송 한도나 Blob의 월간 한도와는 별개입니다.

Vercel Usage와 Resend Usage에서 남은 사용량을 확인합니다. 서비스 한도나 설정 문제로 접수가
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
- `sent.json`: Resend가 접수한 메일 ID와 접수 시각
- `uncertain.json`: 발송 결과가 불확실한 기록
- `rate/`: 원본 IP를 저장하지 않는 요청 제한용 기록

## 3. Resend 발신 도메인 및 API 키

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
   Preview와 Production에 각각 등록하며 서로 다른 키를 권장합니다.

### 확인된 DNS 등록값

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

현재 첨부 제한은 기존과 동일한 총 **10 MiB**, 최대 10개입니다. 서버가 전부 읽어 크기와
파일 시그니처를 확인한 뒤 발송하며, 버퍼링도 전체 10 MiB로 제한됩니다.
메일 인코딩 후 크기는 원본보다 커집니다. Resend 제한뿐 아니라 수신 메일함에서 전체 첨부가 수신되는지 확인합니다.
확장자·시그니처 검증은 악성코드 검사와 동일하지 않으며 압축파일은 서버에서 해제하지 않습니다.

## 4. 환경변수

Vercel Project → Settings → Environment Variables에 등록합니다. 비밀값을 채팅이나 Git에 넣지 않습니다.
환경변수 변경 후에는 해당 환경을 다시 배포해야 합니다.

| 변수 | 값/용도 |
| --- | --- |
| `MAIL_FORMS_ENABLED` | 초기 `false`, 수신 검증 후 `true` |
| `FORM_ALLOWED_ORIGINS` | 운영: `https://mycodx.com,https://www.mycodx.com`; 추가 고정 배포 주소도 필요하면 포함 |
| `FORM_SIGNING_SECRET` | 32자 이상의 무작위 비밀값 |
| `CRON_SECRET` | 위 값과 다른 32자 이상의 무작위 비밀값 |
| `BLOB_READ_WRITE_TOKEN` | 해당 환경의 **Private** Blob 연결 토큰 |
| `RESEND_API_KEY` | Resend 발송 전용 API 키; 사용자 등록 필요 |
| `MAIL_FROM` | `website@send.mycodx.com`; Resend에서 도메인 인증 필요 |
| `CONTACT_TO` | `info@mycodx.com` |
| `CAREERS_TO` | `jakim@mycodx.com` |
| `MAIL_TEST_RECIPIENT` | Preview에서는 테스트 수신 계정; Production에서는 비움 |

`VERCEL_URL`의 해당 배포 출처는 서버에서 자동 허용합니다. 고정 Preview alias는
`FORM_ALLOWED_ORIGINS`에 직접 추가합니다. 테스트 발신 제목에는 `[TEST]`가 붙습니다.
Preview에서는 `MAIL_TEST_RECIPIENT`가 없으면 폼이 활성화되지 않습니다.
`FORM_SIGNING_SECRET`, `CRON_SECRET`은 Production과 Preview별로 서로 다른 무작위 값으로 등록했습니다.
기본 수신 주소·허용 출처·`MAIL_FROM`·`MAIL_FORMS_ENABLED=false`도 등록했습니다.
Preview와 Production의 비밀값·저장소를 분리하면 테스트 접수와 운영 접수가 섞이지 않습니다.

## 5. 실제 배포 검증

1. Preview 저장소·변수를 연결하고 테스트 수신 계정을 지정합니다.
2. Preview에 `MAIL_FORMS_ENABLED=true`를 설정한 뒤 재배포합니다.
3. `/api/forms`가 JSON을 반환하고 `/careers/apply` 새로고침이 동작하는지 확인합니다.
4. 가상 이름과 테스트 문서로 문의·채용을 각각 제출합니다. 실제 개인정보는 테스트에 사용하지 않습니다.
5. 같은 이름의 PDF 2개, 한국어 파일명, 4.5 MiB 초과 파일을 포함해 전체 10 MiB 이내로 확인합니다.
6. 담당 메일함에서 본문, Reply-To, 첨부 개수, 원본 파일 내용을 전부 확인합니다.
7. 제출 버튼 중복 클릭, 업로드 중 네트워크 실패, 응답 유실 시 중복 메일이 생기지 않는지 확인합니다.
8. Cron은 Production 배포에서만 자동 실행됩니다. Preview는 테스트 저장소를 대상으로 정리 API를 인증 호출하여 검증하고, 운영 배포를 진행할 경우 Cron 로그에서도 `/api/forms?action=cleanup` 결과를 확인합니다.
9. Production 변수에 테스트 수신 주소가 없는지 확인하고 운영 환경을 활성화합니다.

Resend API 접수는 실제 받은편지함 배치나 열람을 보장하지 않습니다. 발송 결과가 불확실하면
자동 재전송하지 않습니다. 제출 ID로 `sent.json`/`uncertain.json`과 담당자 수신함을 함께 확인합니다.
브라우저는 제출 직전 해당 탭의 sessionStorage에 개인정보 없는 제출 토큰을 저장합니다.
같은 탭에서 다시 제출하면 새 메일 대신 기존 제출 상태를 확인합니다.
Resend에도 제출 ID를 `Idempotency-Key`로 보내며, 동일 요청에 대한 추가 중복 방지를 적용합니다.

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
Blob 정리로 Resend의 발송 기록이나 메일함의 사본까지 삭제되지는 않습니다.
Resend 계정의 메시지·첨부 보관 설정은 별도로 확인해 회사의 개인정보 보관 정책에 맞춥니다.

접수 중단은 `MAIL_FORMS_ENABLED=false`로 설정하고 재배포합니다. 사이트 화면과 직접 이메일
안내는 유지됩니다. Resend 응답 유실 이후에는 담당자가 수신 여부를 확인하기 전 발송 잠금을
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

- [Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js)
- [Vercel Blob 직접 업로드](https://vercel.com/docs/vercel-blob/client-upload)
- [Vercel Blob 비공개 저장소](https://vercel.com/docs/vercel-blob/private-storage)
- [Resend 도메인 인증](https://resend.com/docs/dashboard/domains/introduction)
- [Resend 발신 주소와 메일함](https://resend.com/docs/knowledge-base/how-do-I-create-an-email-address-or-sender-in-resend)
- [기존 MX와 충돌 방지](https://resend.com/docs/knowledge-base/how-do-i-avoid-conflicting-with-my-mx-records)
- [Resend 첨부파일](https://resend.com/docs/dashboard/emails/attachments)
- [Resend 중복 방지 키](https://resend.com/docs/dashboard/emails/idempotency-keys)
