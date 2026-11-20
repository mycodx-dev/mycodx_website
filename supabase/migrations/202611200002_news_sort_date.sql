-- CES 2027을 ICID 2026보다 위에 표시합니다.
-- 먼저 이번 정렬 코드 변경을 Vercel에 배포한 다음,
-- Supabase SQL Editor에서 postgres 역할로 파일 전체를 실행합니다.
-- CES(/news/3)의 정렬 기준일만 행사 시작일(2027-01-06)로 지정합니다.
-- 게시 날짜, 글 번호·주소, 본문·사진, 다른 소식은 유지합니다.
-- ICID 본문 수정 SQL과 별개이며 적용 순서는 서로 영향을 주지 않습니다.
-- 관리자에서 이후 정렬 기준일을 변경할 수 있습니다. 재실행은 변경하지 않습니다.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
select pg_advisory_xact_lock(20261030, 1);

do $migration$
declare
  post public.news_posts%rowtype;
begin
  if current_user <> 'postgres' then raise exception 'Run as postgres'; end if;
  if not exists (select 1 from recruit_private.migrations where version = '202611040004_news_numbers') then
    raise exception 'Apply the news numbering migration first';
  end if;
  if exists (select 1 from recruit_private.migrations where version = '202611200002_news_sort_date') then
    raise notice 'Already applied. Existing content and order are unchanged.';
    return;
  end if;

  lock table public.news_posts in share row exclusive mode;
  select * into post from public.news_posts where post_number = 3 and slug = '3' for update;
  if not found or post.published is null or
    coalesce(post.published->'title'->>'en', '') !~ 'CES[[:space:]]+2027' then
    raise exception 'The published CES 2027 post /news/3 was not found';
  end if;
  if post.version is distinct from post.published_version or post.draft is distinct from post.published then
    raise exception 'CES post has an unpublished draft; review it in /admin';
  end if;

  execute $function$
    create or replace function public.news_public_list(p_slug text default null,p_before_date text default null,p_before_slug text default null)
    returns jsonb language plpgsql security definer set search_path='' as $body$
    begin
      if p_slug is not null then
        return (select coalesce(jsonb_agg(published || jsonb_build_object('postNumber',post_number)),'[]')
          from public.news_posts where (slug=p_slug or post_number::text=p_slug) and published is not null);
      end if;
      if (p_before_date is null)<>(p_before_slug is null) then raise exception 'INVALID_FILTER'; end if;
      return (select coalesce(jsonb_agg(content order by sort_date desc,slug collate "C" desc),'[]') from (
        select (published - array['body','photos','imageAlt','url']) || jsonb_build_object('postNumber',post_number) as content,
          coalesce(nullif(published->>'sortDate',''),published->>'date') as sort_date,slug
        from public.news_posts where published is not null
          and (p_before_date is null or
            (coalesce(nullif(published->>'sortDate',''),published->>'date'),slug collate "C") < (p_before_date,p_before_slug collate "C"))
        order by coalesce(nullif(published->>'sortDate',''),published->>'date') desc,slug collate "C" desc limit 21
      ) x);
    end
    $body$;
  $function$;

  -- CREATE OR REPLACE keeps the existing server-only grants.
  drop index public.news_public_order;
  create index news_public_order on public.news_posts
    ((coalesce(nullif(published->>'sortDate',''),published->>'date')) desc,slug collate "C" desc)
    where published is not null;

  update public.news_posts
  set draft = jsonb_set(draft, '{sortDate}', '"2027-01-06"'::jsonb),
      published = jsonb_set(published, '{sortDate}', '"2027-01-06"'::jsonb),
      version = version + 1, published_version = version + 1, updated_at = clock_timestamp()
  where id = post.id;
  insert into recruit_private.migrations(version) values('202611200002_news_sort_date');
end
$migration$;
commit;

-- 확인: CES 2027 → ICID 2026 → KIMES BUSAN 2026 → 홈페이지 개설 순서.
select '/news/' || post_number as public_path,
  published->'title'->>'ko' as title,
  published->>'date' as publication_date,
  coalesce(nullif(published->>'sortDate',''),published->>'date') as sort_date
from public.news_posts where published is not null
order by coalesce(nullif(published->>'sortDate',''),published->>'date') desc,slug collate "C" desc;
