-- 사용자 요청에 따라 CES와 ICID의 공개 번호·주소를 한 번 교환합니다.
-- 먼저 정렬 코드 배포 및 202611200002_news_sort_date.sql 적용을 완료한 뒤,
-- Supabase SQL Editor에서 postgres 역할로 파일 전체를 실행합니다.
-- 결과: CES 2027 = /news/4, ICID 2026 = /news/3.
-- 기존 /news/3, /news/4 링크도 각각 새로 배정된 글을 가리킵니다.
-- 내부 UUID, 본문·사진·번역, 게시 날짜, 정렬 기준일, 공개/초안 상태 및 이력은 유지합니다.
-- 열어 둔 관리자 편집본은 버전 충돌로 보호합니다. 적용 후 최신 저장본을 불러오세요.
-- 재실행은 아무것도 바꾸지 않습니다. 번호 발급 시퀀스는 변경하지 않습니다.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
select pg_advisory_xact_lock(20261030, 1);

do $migration$
declare
  ces public.news_posts%rowtype;
  icid public.news_posts%rowtype;
  temporary_number bigint;
  temporary_slug text := 'news-swap-' || gen_random_uuid()::text;
begin
  if current_user <> 'postgres' then raise exception 'Run as postgres'; end if;
  if exists (select 1 from recruit_private.migrations where version = '202611200003_swap_ces_icid_addresses') then
    raise notice 'Already applied. Existing addresses and content are unchanged.';
    return;
  end if;
  if not exists (select 1 from recruit_private.migrations where version = '202611200002_news_sort_date') then
    raise exception 'Apply 202611200002_news_sort_date.sql first';
  end if;

  lock table public.news_posts in share row exclusive mode;
  select * into ces from public.news_posts where post_number = 3 and slug = '3' for update;
  if not found or coalesce(ces.draft->'title'->>'en', '') !~ 'CES[[:space:]]+2027' then
    raise exception 'Expected CES 2027 at /news/3; no addresses changed';
  end if;
  select * into icid from public.news_posts where post_number = 4 and slug = '4' for update;
  if not found or coalesce(icid.draft->'title'->>'en', '') !~ 'ICID[[:space:]]+2026' then
    raise exception 'Expected ICID 2026 at /news/4; no addresses changed';
  end if;
  if (ces.published is not null and coalesce(ces.published->'title'->>'en', '') !~ 'CES[[:space:]]+2027')
    or (icid.published is not null and coalesce(icid.published->'title'->>'en', '') !~ 'ICID[[:space:]]+2026') then
    raise exception 'Published titles do not match the expected posts; no addresses changed';
  end if;

  -- A temporary unused address avoids the immediate UNIQUE constraints.
  -- It exists only inside this transaction and does not consume a sequence value.
  select max(post_number)::bigint + 1 into temporary_number from public.news_posts;
  if temporary_number > 2147483647 or exists(select 1 from public.news_posts where slug = temporary_slug) then
    raise exception 'No temporary address available; no addresses changed';
  end if;
  update public.news_posts
  set slug = temporary_slug, post_number = temporary_number::integer,
      draft = jsonb_set(draft, '{id}', to_jsonb(temporary_slug)),
      published = case when published is null then null else jsonb_set(published, '{id}', to_jsonb(temporary_slug)) end
  where id = ces.id;

  update public.news_posts
  set slug = '3', post_number = 3,
      draft = icid.draft || '{"id":"3"}'::jsonb || case when icid.draft ? 'postNumber' then '{"postNumber":3}'::jsonb else '{}'::jsonb end,
      published = case when icid.published is null then null else
        icid.published || '{"id":"3"}'::jsonb || case when icid.published ? 'postNumber' then '{"postNumber":3}'::jsonb else '{}'::jsonb end end,
      version = version + 1,
      published_version = case when published_version is null then null else published_version + 1 end,
      updated_at = clock_timestamp()
  where id = icid.id;

  update public.news_posts
  set slug = '4', post_number = 4,
      draft = ces.draft || '{"id":"4"}'::jsonb || case when ces.draft ? 'postNumber' then '{"postNumber":4}'::jsonb else '{}'::jsonb end,
      published = case when ces.published is null then null else
        ces.published || '{"id":"4"}'::jsonb || case when ces.published ? 'postNumber' then '{"postNumber":4}'::jsonb else '{}'::jsonb end end,
      version = ces.version + 1,
      published_version = case when ces.published_version is null then null else ces.published_version + 1 end,
      updated_at = clock_timestamp()
  where id = ces.id;

  insert into recruit_private.migrations(version) values('202611200003_swap_ces_icid_addresses');
end
$migration$;
commit;

-- 확인: /news/4 = CES, /news/3 = ICID. 공개 소식은 CES가 먼저 표시됩니다.
select '/news/' || post_number as public_path,
  draft->'title'->>'ko' as title_ko,
  draft->'title'->>'en' as title_en,
  published is not null as is_published,
  published is not null and version <> published_version as has_unpublished_changes
from public.news_posts where post_number in (3, 4)
order by post_number desc;
