# 과거 FormSubmit 수신 검증 이력

> 아래 내용은 이전 구현의 기록입니다. 현재는 Vercel API, 비공개 Blob과 선택 가능한 SMTP / Resend 발송으로 교체했으며,
> 과거 콜백 파일과 테스트 명령은 더 이상 사용하지 않습니다. 현재 설정·검증 절차는
> [Vercel 메일 설정](vercel-mail-setup.md)을 따릅니다.

# 채용 메일 전송

수신 주소: `jakim@mycodx.com`

## 확인된 사실 (2026-10-13)

- AJAX 테스트 B: 서비스는 성공을 응답했지만 수신자는 본문만 수신하고 첨부는 받지 못했습니다.
- 일반 multipart POST 테스트 C: 수신자가 첨부 도착을 확인했습니다. 4개 각각의 수신 여부는 별도로 확인되지 않았습니다. 각 파일은 `attachment`, `attachment2`, `attachment3`, `attachment4`라는 서로 다른 필드로 전송했습니다.

## 홈페이지 구현

일반 FormSubmit 엔드포인트로 네이티브 multipart POST를 전송합니다. `formdata` 이벤트에서 복수 첨부를 각각 고유한 필드로 바꾸며, 메일 본문에 항목과 파일명 목록을 함께 보냅니다.

전송 대상은 숨겨진 iframe입니다. `_next`는 현재 홈페이지 origin의 `/careers-submit-complete.html?token=...`입니다. FormSubmit이 해당 정적 페이지로 리디렉션하면 부모 페이지로 완료 메시지를 보냅니다. 부모는 origin, iframe의 창, 제출별 임의 토큰을 모두 확인한 후에만 완료 창을 표시합니다. 외부 페이지나 프레임의 단순 load 이벤트는 성공으로 간주하지 않습니다.

90초 동안 완료를 확인하지 못하면 입력과 첨부파일을 유지하고 접수 여부 확인을 안내합니다. 메일은 전송되었지만 완료 응답만 차단된 경우도 있으므로 자동 재전송하지 않습니다. 서버 접수 확인이 최종 수신함 배달을 보장하는 것은 아닙니다.

## 배포 확인

1. `public/careers-submit-complete.html` 및 `.js`가 빌드 결과에 포함되어야 합니다. React의 SPA 라우팅 대신 실제 정적 파일로 제공해야 합니다.
2. 배포된 홈페이지에서 테스트 PDF 4개(학위 증명서 2개 포함)를 선택하여 제출합니다.
3. 페이지 이동 없이 내부 완료 창이 표시되는지 확인합니다.
4. 수신 메일의 입력 내용, 첨부 목록, PDF 4개를 확인합니다.

테스트 C는 일반 업로드의 첨부 수신을 확인했지만 전체 파일 개수 검증은 남아 있습니다. 이후 localhost 테스트에서 첨부 1개만 수신했다는 보고가 있어 복수 파일 전달은 미해결 상태입니다. 변경된 홈페이지의 iframe 왕복 동작과 수신을 함께 확인하는 운영 검증은 배포 후 별도로 필요합니다.

## 검사

Node.js 24에서 `node --test tests/careersApplication.test.mjs`, `npm run lint`, `npm run build`를 실행합니다. 회귀 테스트는 복수 첨부의 이름과 내용 보존, 고유 필드 생성, 잘못된 origin/창/토큰 거절, 정적 완료 페이지의 메시지를 검증합니다. 실제 메일을 보내지 않습니다.

수신 주소의 인증이 해제되면 FormSubmit 인증을 다시 완료해야 합니다. 미인증 제출의 첨부파일은 보관되지 않습니다.

공식 자료: https://formsubmit.co/help · https://formsubmit.co/documentation
