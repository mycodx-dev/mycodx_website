-- LOCAL DISPOSABLE DATABASE ONLY. Creates fake data and roles in a NEW empty cluster.
-- NEVER run this test fixture in Supabase SQL Editor.
\set ON_ERROR_STOP on
\ir news-order.integration.sql

-- Restore the requested CES order after the preceding admin-edit tests.
update public.news_posts set
  draft = draft || '{"sortDate":"2027-01-06","postNumber":3}'::jsonb,
  published = published || '{"sortDate":"2027-01-06","postNumber":3}'::jsonb
where slug='3';
-- Include a pending ICID draft, bilingual content, and a photo to verify preservation.
update public.news_posts set
  published = published || '{"postNumber":4,"image":"/uploads/news/icid-2026-poster.jpg","body":{"ko":"Public body","en":"Public English body"}}'::jsonb,
  draft = draft || '{"postNumber":4,"image":"/uploads/news/icid-2026-poster.jpg","body":{"ko":"Private draft","en":"Private English draft"}}'::jsonb,
  version = version+1
where slug='4';
create temp table before_swap as select * from public.news_posts;
create temp table sequence_before_swap as select last_value,is_called from public.news_post_number_seq;
create temp table audit_before_swap as select * from public.news_audit_logs;

\ir ../supabase/migrations/202611200003_swap_ces_icid_addresses.sql

do $$ declare old_post public.news_posts%rowtype; new_post public.news_posts%rowtype; target integer; begin
  for old_post in select * from before_swap where slug in ('3','4') loop
    target:=case old_post.slug when '3' then 4 else 3 end;
    select * into new_post from public.news_posts where id=old_post.id;
    if new_post.slug<>target::text or new_post.post_number<>target
      or new_post.draft->>'id'<>target::text or new_post.published->>'id'<>target::text
      or (new_post.draft->>'postNumber')::integer<>target
      or (new_post.published->>'postNumber')::integer<>target then
      raise exception 'Public addresses or embedded IDs were not swapped'; end if;
    if new_post.draft-array['id','postNumber'] is distinct from old_post.draft-array['id','postNumber']
      or new_post.published-array['id','postNumber'] is distinct from old_post.published-array['id','postNumber']
      or new_post.published_at is distinct from old_post.published_at then
      raise exception 'Body, translations, image, dates, or publication time changed'; end if;
    if new_post.version<>old_post.version+1 or new_post.published_version<>old_post.published_version+1
      or (new_post.version<>new_post.published_version) is distinct from (old_post.version<>old_post.published_version) then
      raise exception 'Version or draft state not preserved'; end if;
    begin
      perform public.news_save('11111111-1111-4111-8111-111111111111',old_post.id,old_post.version,old_post.draft);
      raise exception 'STALE_SAVE_ALLOWED';
    exception when others then if sqlerrm<>'VERSION_CONFLICT' then raise; end if; end;
  end loop;
  if exists(select 1 from public.news_posts n join before_swap o using(id)
    where o.slug not in ('3','4') and to_jsonb(n)<>to_jsonb(o)) then raise exception 'Another post changed'; end if;
  if (select count(*) from public.news_posts)<>(select count(*) from before_swap)
    or exists(select 1 from public.news_posts where slug like 'news-swap-%') then raise exception 'Temporary address persisted'; end if;
  if exists(select 1 from public.news_post_number_seq n,sequence_before_swap o where n.last_value<>o.last_value or n.is_called<>o.is_called) then
    raise exception 'Number sequence changed'; end if;
  if exists((select * from public.news_audit_logs except select * from audit_before_swap)
    union all (select * from audit_before_swap except select * from public.news_audit_logs)) then raise exception 'Audit history changed'; end if;
end $$;

set role service_role;
do $$ declare icid jsonb; ces jsonb; begin
  icid:=public.news_public_list('3')->0;
  ces:=public.news_public_list('4')->0;
  if icid->'title'->>'en'<>'ICID 2026' or icid->'body'->>'ko'<>'Public body' or (icid->>'postNumber')::integer<>3 then
    raise exception 'ICID detail missing or draft leaked'; end if;
  if ces->'title'->>'en'!~'CES 2027' or (ces->>'postNumber')::integer<>4 then raise exception 'CES detail missing'; end if;
  if public.news_public_list()->0->>'id'<>'4' then raise exception 'CES is not first'; end if;
  if jsonb_array_length(public.news_public_list('private'))<>0 then raise exception 'Private post leaked'; end if;
end $$;
reset role;

create temp table after_swap as select * from public.news_posts;
\ir ../supabase/migrations/202611200003_swap_ces_icid_addresses.sql
do $$ begin
  if exists(select 1 from public.news_posts n join after_swap o using(id) where to_jsonb(n)<>to_jsonb(o)) then
    raise exception 'Reapplication reversed addresses or changed content'; end if;
end $$;
select 'CES /news/4, ICID /news/3, content/history preservation, draft isolation, stale edits, and reapplication passed' as result;
