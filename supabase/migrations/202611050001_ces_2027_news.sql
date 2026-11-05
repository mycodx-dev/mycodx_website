-- CES 2027 참가 확정 소식 1건 게시 (한국어/영어).
-- Supabase SQL Editor > New query > Role postgres에서 파일 전체를 실행합니다.
-- 실행 즉시 공개 소식에 추가됩니다. 코드 배포/환경변수 변경은 필요 없습니다.
-- 행사 일정/장소 출처: https://www.ces.tech/attend/registration-notification
-- MycoDx 참가 확정은 회사 담당자가 제공한 사실입니다.
-- 부스 번호, 전시 제품, 수상/선정 여부, 현장 사진은 추가하지 않습니다.
-- 게시일은 2026-11-05이며 행사 개최일과 구분합니다.
-- 재실행은 아무것도 수정하지 않습니다. 게시 후 수정/비공개는 /admin에서 합니다.
-- 기존 뉴스 초기 가져오기처럼 postgres가 콘텐츠를 등록합니다.
-- 특정 관리자의 작업으로 가장하지 않으며 실행 이력은 migrations에 남깁니다.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
select pg_advisory_xact_lock(20261030, 1);

do $migration$
declare
  news_id constant uuid := '32b82e92-048a-45d0-9b2e-c7df90bc1e41';
  number integer;
  content jsonb := $content${
    "id": "",
    "visible": true,
    "date": "2026-11-05",
    "category": "Exhibition",
    "title": {
      "ko": "MycoDx, CES 2027 참가 확정",
      "en": "MycoDx confirms participation in CES 2027"
    },
    "summary": {
      "ko": "MycoDx의 CES 2027 참가가 확정되었습니다. 행사는 2027년 1월 6일부터 9일까지 미국 라스베이거스에서 개최됩니다.",
      "en": "MycoDx has confirmed its participation in CES 2027, taking place January 6–9, 2027, in Las Vegas, USA."
    },
    "body": {
      "ko": "MycoDx의 CES 2027 참가가 확정되었습니다. CES 2027은 2027년 1월 6일부터 9일까지 미국 라스베이거스에서 개최됩니다.\n\n부스 위치와 전시 내용 등 세부 참가 정보는 확정되는 대로 홈페이지 소식란을 통해 안내하겠습니다.\n\nCES 2027에서 전해드릴 MycoDx의 새로운 소식에 많은 관심 부탁드립니다.",
      "en": "MycoDx has confirmed its participation in CES 2027. The event will take place January 6–9, 2027, in Las Vegas, USA.\n\nDetails of our participation, including the booth location and exhibition content, will be announced in the news section of our website as they are confirmed.\n\nStay tuned for more updates from MycoDx at CES 2027."
    },
    "url": "https://www.ces.tech/",
    "image": "",
    "imageAlt": { "ko": "", "en": "" },
    "photos": []
  }$content$::jsonb;
begin
  if current_user <> 'postgres' then raise exception 'Run as postgres'; end if;
  if not exists (select 1 from recruit_private.migrations where version = '202611040004_news_numbers') then
    raise exception 'Apply the news numbering migration first';
  end if;
  if exists (select 1 from recruit_private.migrations where version = '202611050001_ces_2027_news') then
    raise notice 'Already applied. Existing content and publication status are unchanged.';
    return;
  end if;

  -- Serialize the duplicate check with administrator saves/publishes.
  lock table public.news_posts in share row exclusive mode;
  if exists (
    select 1 from public.news_posts
    where id = news_id
      or coalesce(draft->'title'->>'ko', '') ~* 'CES[[:space:]]*2027'
      or coalesce(draft->'title'->>'en', '') ~* 'CES[[:space:]]*2027'
      or coalesce(published->'title'->>'ko', '') ~* 'CES[[:space:]]*2027'
      or coalesce(published->'title'->>'en', '') ~* 'CES[[:space:]]*2027'
  ) then
    raise exception 'A CES 2027 post already exists. Review it in /admin instead of inserting another.';
  end if;

  number := nextval('public.news_post_number_seq');
  content := jsonb_set(content, '{id}', to_jsonb(number::text));
  insert into public.news_posts (id, slug, post_number, draft, published, published_version, published_at)
  values (news_id, number::text, number, content, content, 1, now());
  insert into recruit_private.migrations (version) values ('202611050001_ces_2027_news');
end
$migration$;
commit;

-- 확인 결과: 1행, is_published=true, public_path는 /news/<자동 번호>.
-- 기존 글이 1번/2번이고 시퀀스가 그대로라면 /news/3입니다. 번호를 강제하지 않습니다.
select post_number, '/news/' || post_number as public_path,
  draft->'title'->>'ko' as title,
  draft->>'date' as post_date,
  published is not null as is_published
from public.news_posts
where id = '32b82e92-048a-45d0-9b2e-c7df90bc1e41'::uuid;
