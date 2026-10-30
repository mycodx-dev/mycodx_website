# MycoDx Website — Vercel · Resend

React + TypeScript + Vite 홈페이지입니다. 기존 문의·채용 폼의 화면을 유지하고,
Vercel Functions + 비공개 Vercel Blob + Resend API로 전송합니다. 이카운트는 기존 수신 메일함으로 사용합니다.

- 문의: `info@mycodx.com`, 채용: `jakim@mycodx.com`
- 채용 첨부는 브라우저에서 비공개 Blob으로 직접 업로드합니다(총 10 MiB, 최대 10개).
- 서버가 모든 파일을 검증한 뒤 Resend API로 원본을 첨부합니다.
- Resend의 접수 ID를 확인한 경우에만 전송 요청 완료를 표시합니다. 실제 수신 확인은 별도입니다.
- 설정 누락 또는 `MAIL_FORMS_ENABLED=false`이면 접수를 비활성화하고 직접 이메일을 안내합니다.
- Vercel 프로젝트와 서울 리전의 테스트용·운영용 비공개 Blob을 연결했습니다. Resend 도메인 인증·API 키 등록과 실제 수신 검증이 남아 있습니다.

배포 절차와 환경변수는 [Vercel 설정 안내](docs/vercel-mail-setup.md)를 참고하세요.

## 새 저장소에 가져갈 파일

압축을 푼 `mycodx-website` 폴더의 **내용 전체**를 새 저장소 최상위에 넣습니다.
저장소 첫 화면에 `package.json`, `src`, `public`, `vercel.json`이 보이는 구조입니다.
ZIP 파일 자체를 저장소에 올리는 방식이 아닙니다.

| 파일/폴더 | 용도 |
| --- | --- |
| `src/` | 화면, 번역, 스타일, 콘텐츠 JSON, 로고·이미지 |
| `public/` | 공개 이미지, 소식 사진, PDF, 지원서 DOCX, 아이콘, 검색 관련 파일 |
| `index.html` | 웹사이트 진입점 |
| `package.json`, `package-lock.json` | 실행 명령과 의존성 버전 |
| `vite.config.ts`, `tsconfig*.json` | Vite·TypeScript 빌드 설정 |
| `tailwind.config.js`, `postcss.config.js`, `eslint.config.js` | 스타일 및 코드 검사 설정 |
| `vercel.json`, `.nvmrc` | Vercel 배포 설정, Node.js 24 |
| `.gitignore` | 의존성·빌드 결과·환경변수 파일 제외 |
| `.pages.yml`, `CMS_GUIDE.md` | Pages CMS 콘텐츠 편집 설정 및 안내 |
| `api/`, `server/`, `shared/` | 접수 API, Resend 발송, 비공개 업로드·검증 |
| `docs/`, `tests/` | 배포 안내, 메일 전송 이력과 회귀 테스트 |

`.pages.yml`, `.gitignore`, `.nvmrc`는 숨김 파일이므로 함께 옮겨야 합니다.
`.pages.yml`은 **Pages CMS 설정**으로, GitHub Pages 전용 배포 설정과 다릅니다.

원본의 `.github/workflows/deploy.yml`과 `public/CNAME`은 GitHub Pages 전용이라 이 배포본에서 제외했습니다.
`.git`, `node_modules`, `dist`, 기존 `output` 및 로컬 환경 파일도 포함하지 않았습니다.
이미지, 뉴스 사진, 논문 PDF와 지원서 양식은 모두 포함했습니다.

## 새 GitHub 저장소 만들기

1. 본인 또는 회사가 소유한 새 GitHub 저장소를 만듭니다. 예: `mycodx-website`.
2. 빈 저장소로 만든 뒤, 이 폴더를 GitHub Desktop 등으로 연결해 파일 전체를 커밋하고 Push합니다.
3. 기존 홈페이지 저장소와 별도로 관리합니다. 이 ZIP에는 이전 Git 이력이 포함되지 않습니다.

터미널을 사용한다면 압축을 푼 `mycodx-website` 폴더 안에서 실행합니다.
아래 원격 주소는 실제 새 저장소 주소로 바꿉니다.

```bash
git init -b main
git add .
git commit -m "Initial Vercel website"
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_NEW_REPOSITORY.git
git push -u origin main
```

## Vercel 연결

1. Vercel에서 GitHub 계정을 연결하고 **새 저장소**를 Import합니다.
2. 아래 설정으로 Deploy합니다. 대부분은 `vercel.json`에 지정되어 있습니다.

| 항목 | 설정 |
| --- | --- |
| Framework Preset | Vite |
| Root Directory | `.` — `package.json`이 있는 폴더 |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js | `24.x` — `package.json`의 engines에 지정 |
| Environment Variables | `.env.example` 및 [설정 안내](docs/vercel-mail-setup.md) 참고 |

`vercel.json`에는 `/api/`를 제외한 SPA rewrite, 서울 함수 리전, 180초 실행 제한,
하루 1회 임시파일 정리 Cron을 설정했습니다. Cron은 `0 18 * * *`(UTC 18시, 한국시간 다음 날 03시)이며,
Hobby에서는 해당 시간대의 03:00~03:59 사이에 실행될 수 있습니다.
Hobby에서도 180초 실행 제한을 사용할 수 있도록 `fluid: true`를 명시했습니다.

이 설정은 Hobby의 기술 제한에 맞춘 구성입니다. 다만 [Vercel Hobby](https://vercel.com/docs/plans/hobby)는
개인 비상업용으로 제한되므로 MycoDx 회사 홈페이지의 운영 용도로 적합하지 않습니다.
회사 사이트를 무료로 운영해야 한다면 상업적 사용을 허용하는 다른 무료 호스팅을 선택해야 합니다.
유료 플랜 가입이나 결제를 전제로 하지 않으며, 사용량 한도와 남은 설정은
[무료 플랜 안내](docs/vercel-mail-setup.md#무료-플랜-사용량)를 참고하세요.
GitHub Pages에서 쓰던 `404.html` 복사 작업은 필요하지 않습니다.

먼저 Vercel에서 제공하는 주소로 `/`, `/news`, `/careers`, `/careers/apply`, `/privacy`를 직접 열어 확인합니다.
이미지 표시, 언어 전환, 지원서 DOCX와 PDF 다운로드, 이메일 주소 복사도 확인합니다.
실제 Vercel 배포 검증과 도메인 연결은 아직 수행하지 않았습니다.

## 개발 및 검사

Node.js 24에서 실행합니다. nvm 사용자는 `nvm use`로 `.nvmrc`의 버전을 적용할 수 있습니다.

```bash
npm ci
npm run dev
```

```bash
npm run lint
npm test
npm run build
npm run preview
```

`node_modules`와 `dist`는 위 명령으로 다시 생성되므로 Git에 올리지 않습니다.

## 메일 전송 방식

1. `/api/forms`가 제출값·동의·파일 목록을 검증하고 1시간 유효한 제출 토큰과 파일별 업로드 권한을 발급합니다.
2. 채용 파일은 Vercel 함수를 거치지 않고 비공개 Blob에 직접 업로드합니다.
3. `/api/forms`에 제출 토큰만 보내면 서버가 파일 크기·확장자·시그니처를 확인하고 Resend API로 발송합니다.
4. 제출별 불변 발송 잠금과 상태 파일을 Blob에 기록합니다. 중복 요청과 응답 유실에 따른 자동 재발송을 막습니다.
5. 전송 결과가 불확실하면 성공으로 표시하거나 자동 재발송하지 않습니다. 담당자의 메일함 확인이 필요합니다.
6. 임시 서류와 전송 기록은 업로드 후 7일이 지난 다음 일일 정리 작업에서 삭제합니다. 정확히 7일째 삭제되는 것은 아니며, 다음 작업까지 대기 시간이 추가됩니다. 발송된 메일의 보유기간은 별도입니다.

기존 FormSubmit 서비스 코드와 iframe 콜백 파일은 제거했습니다.
이전 수신 장애 이력은 [기록](docs/careers-mail-verification.md)에 보존되어 있습니다.

로컬 API까지 확인하려면 `.env.example`을 `.env.local`로 복사한 후 두 터미널에서
`npm run dev:api`, `npm run dev`를 실행합니다. 개발용 허용 출처에 `http://localhost:5173`을 추가합니다.
실제 자격정보가 없으면 접수는 닫힌 상태로 표시됩니다. 로컬 목 테스트는 실제 메일을 보내지 않습니다.

## 콘텐츠와 도메인 이전

Pages CMS를 계속 쓰려면 새 저장소에도 Pages CMS 접근 권한을 부여하고, CMS에서 새 저장소를 선택합니다.
[CMS_GUIDE.md](CMS_GUIDE.md)의 콘텐츠 편집 방법은 동일하게 사용할 수 있습니다.

웹사이트 검증이 끝나면 Vercel의 도메인 설정에 `mycodx.com`을 추가하고, DNS 관리 화면에서 Vercel이 안내하는 웹 연결 레코드를 적용합니다.
메일용 MX 및 SPF/DKIM/DMARC TXT 레코드는 웹 호스팅 이전과 구분해 유지합니다.

현재 canonical, Open Graph 및 sitemap 주소는 `https://mycodx.com`을 기준으로 유지했습니다.
최종 도메인을 바꿀 경우 `src/components/common/PageMeta.tsx`, `index.html`, `public/robots.txt`, `public/sitemap.xml`을 함께 수정합니다.

## 공식 자료

- [Vite on Vercel — SPA 경로 설정](https://vercel.com/docs/frameworks/frontend/vite#using-vite-to-make-spas)
- [Vercel 설정 파일](https://vercel.com/docs/project-configuration/vercel-json)
- [Vercel Node.js 버전](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

## 검증 범위

`npm test`는 외부 서비스 대신 메모리 저장소와 메일 대역을 사용해 검증합니다.
6 MiB 첨부 전달, 복수 첨부 보존, 동의·입력·파일 검증, 업로드 누락,
동시 제출, 발송 결과 불확실성, 저장 실패, 토큰 변조·만료, 요청 제한과 Resend 요청의 첨부·중복 방지 키를 확인합니다.
`npm run build`는 프런트엔드와 서버 TypeScript를 함께 검사합니다.
운영 수신함 및 실제 Blob 연결 검증은 [배포 안내](docs/vercel-mail-setup.md)에 따라 별도로 수행합니다.
브라우저 화면 검증과 의존성 보안 진단의 남은 항목도 같은 안내에 기록했습니다.
