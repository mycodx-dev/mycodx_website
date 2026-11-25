-- 국립창원대학교 경남생명항노화 핵심연구지원센터 업무협약 소식 1건 게시.
-- 체결일/게시일: 2026-11-25 (회사 담당자 제공). 사진 없이 한국어로 게시합니다.
-- Supabase SQL Editor > New query > Role postgres에서 파일 전체를 실행합니다.
-- 실행 즉시 공개됩니다. 테이블/권한/환경변수/Storage 변경은 없습니다.
-- 재실행은 기존 글을 수정하거나 다시 공개하지 않습니다. 이후 편집은 /admin에서 합니다.
-- 기존 글과 초안을 보존하며, 실행 이력은 recruit_private.migrations에 기록합니다.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
select pg_advisory_xact_lock(20261030, 1);

do $migration$
declare
  news_id constant uuid := 'b8d6ae47-e5e3-4e56-bc41-96e79624ba25';
  number integer;
  content jsonb := $content${
  "id": "",
  "visible": true,
  "date": "2026-11-25",
  "category": "Partnership",
  "title": {
    "ko": "마이코디엑스, 국립창원대학교 경남생명항노화 핵심연구지원센터와 업무협약 체결",
    "en": ""
  },
  "summary": {
    "ko": "공동연구 및 기술교류 활성화를 위한 상호협력 기반 마련",
    "en": ""
  },
  "body": {
    "ko": "㈜마이코디엑스와 국립창원대학교 경남생명항노화 핵심연구지원센터는 2026년 11월 25일, 상호 존중과 신뢰를 바탕으로 연구역량 강화와 공동 발전을 위한 상호협력 양해각서(MOU)를 체결했습니다.\n\n이번 협약을 통해 양 기관은 보유한 연구역량, 기술 및 인프라를 적극 활용하여 공동연구와 기술교류를 활성화하고, 상호 협력을 통한 연구성과 창출과 공동 발전을 도모할 예정입니다.",
    "en": ""
  },
  "image": "",
  "imageAlt": {
    "ko": "",
    "en": ""
  },
  "url": "",
  "photos": []
}$content$::jsonb;
begin
  if current_user <> 'postgres' then raise exception 'Run as postgres'; end if;
  if not exists (select 1 from recruit_private.migrations where version = '202611040004_news_numbers') then
    raise exception 'Apply the news numbering migration first';
  end if;
  if exists (select 1 from recruit_private.migrations where version = '202611250001_changwon_mou_news') then
    raise notice 'Already applied. Existing content and publication status are unchanged.';
    return;
  end if;

  -- Serialize the duplicate check with administrator saves/publishes.
  lock table public.news_posts in share row exclusive mode;
  if exists (
    select 1 from public.news_posts
    where id = news_id
      or (coalesce(draft->'title'->>'ko', '') like '%경남생명항노화%'
          and coalesce(draft->>'date', '') = '2026-11-25')
      or (coalesce(published->'title'->>'ko', '') like '%경남생명항노화%'
          and coalesce(published->>'date', '') = '2026-11-25')
  ) then
    raise exception 'A Changwon MOU post for this date already exists. Review it in /admin instead of inserting another.';
  end if;

  number := nextval('public.news_post_number_seq');
  content := jsonb_set(content, '{id}', to_jsonb(number::text));
  insert into public.news_posts (id, slug, post_number, draft, published, published_version, published_at)
  values (news_id, number::text, number, content, content, 1, now());
  insert into recruit_private.migrations (version) values ('202611250001_changwon_mou_news');
end
$migration$;
commit;

-- 확인 결과: 1행, is_published=true, public_path는 /news/<자동 번호>.
-- 기존 글과 초안의 번호를 보존하고 다음 번호를 자동으로 배정합니다.
select post_number, '/news/' || post_number as public_path,
  draft->'title'->>'ko' as title,
  draft->>'date' as post_date,
  published is not null as is_published
from public.news_posts
where id = 'b8d6ae47-e5e3-4e56-bc41-96e79624ba25'::uuid;
