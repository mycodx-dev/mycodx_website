# 소식 자동 번호 적용

## 동작

- 첫 임시저장 시 DB가 번호를 자동 발급합니다. 글 주소 입력란은 제거되며 저장 후 `/news/<번호>`가 표시됩니다.
- 내부 UUID는 편집·중복 저장 방지에 그대로 사용합니다. 공개 번호는 제목, 게시 날짜, 임시저장, 게시/비공개 전환으로 바뀌지 않습니다.
- 기존 slug와 제목·본문·이미지, 초안/공개본, 감사 기록은 보존합니다. 기존 영문 주소를 조회하면 같은 게시물을 읽고 브라우저가 숫자 주소로 이동합니다. 공개 목록과 canonical 메타도 숫자 주소를 사용합니다. HTTP 301 리디렉션은 아닙니다.
- 기존 두 소식만 있다면 홈페이지 개설은 `/news/1`, KIMES BUSAN 2026은 `/news/2`입니다. 다른 기존 글이 있다면 적용 후 검증 결과의 번호를 확인합니다. 기존 숫자 주소가 있으면 먼저 보존하고, 나머지 글을 게시 날짜·기존 주소순으로 배정합니다.
- 번호는 게시물 개수나 정렬 순서가 아닙니다. 삭제·실패·트랜잭션 취소로 결번이 생길 수 있으며 재사용하지 않습니다. 목록은 계속 게시 날짜 최신순입니다.
- 임시저장 글의 숫자를 추측해도 공개 API로 읽을 수 없습니다. 승인된 관리자만 편집·게시할 수 있고 기존 RLS/서버 전용 RPC 권한을 유지합니다.

## 적용 순서 — 직접 실행

1. 앞서 준비된 검색·소식 SQL 3개가 적용되어 있어야 합니다. 미적용 상태이면 [기존 설정 안내](admin-search-news-setup.md)의 1~3번 SQL을 먼저 적용합니다. 이미 적용한 원본 마이그레이션을 재실행하거나 테이블을 삭제하지 않습니다.
2. Supabase SQL Editor → New query → Role `postgres`에서 `supabase/migrations/202611040004_news_numbers.sql` 전체를 실행합니다. 원격 DB 실행은 사용자가 진행합니다.
3. 별도 쿼리로 `supabase/verification/05_news_numbers_verify.sql`을 실행합니다. 마이그레이션 이력 1건, 양수·고유 번호, RLS=true, 직접 테이블·시퀀스 접근=false, RPC의 anon/authenticated 실행=false, service_role 실행=true를 확인합니다.
4. SQL 성공 후 코드 커밋·push → Vercel Ready 확인. 기존 `NEWS_CMS_ENABLED=true`와 Supabase 환경변수는 유지합니다. 이 변경에 새 환경변수는 필요 없습니다.
5. `/admin` → 소식 관리에서 기존 글 주소, 새 글 자동 번호, 임시저장·게시를 확인합니다. 기존 `/news/website-launch`, `/news/kimes-busan-2026`도 확인합니다.

이번 변경은 운영 Supabase SQL, Vercel 환경변수·배포, `mycodx.com` DNS를 직접 변경하지 않습니다. 유료 기능이나 새 의존성을 사용하지 않습니다.

## 오류·복구

- SQL은 트랜잭션으로 실행합니다. 오류가 나면 다음 단계로 넘어가지 않습니다. 재실행 시 `Already applied`이면 이미 적용된 이력부터 확인합니다. 다시 실행하려고 이력을 삭제하지 않습니다.
- 기존 글을 재생성하거나 news seed SQL을 다시 실행하지 않습니다. 발급된 번호를 임의로 바꾸거나 시퀀스를 초기화하지 않습니다.
- DB 복원 시 `news_posts`, `news_audit_logs`와 시퀀스 상태를 함께 복원합니다. 이미 외부에 알려진 번호는 재사용하지 않습니다. 오래된 백업으로 복원하는 경우 백업 이후 발급된 번호까지 고려한 상한을 확인해야 합니다.
- 코드 롤백 시 추가 컬럼과 기존 slug는 유지합니다. 컬럼·시퀀스를 삭제하는 역마이그레이션은 제공하지 않습니다. 이전 UI는 영문 주소를 다시 표시할 수 있습니다.

## 로컬 검증

`npm test`, `npm run lint`, `npm run build`를 실행합니다. `tests/news-numbers.integration.sql`은 격리된 임시 PostgreSQL에서 `tests/admin-cms.integration.sql` 다음에 실행하는 테스트입니다. **테스트 SQL은 운영 Supabase에서 실행하지 않습니다.**
