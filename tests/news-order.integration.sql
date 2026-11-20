-- LOCAL DISPOSABLE DATABASE ONLY. Requires a NEW empty PostgreSQL cluster/database.
-- NEVER run this test fixture in Supabase SQL Editor.
\set ON_ERROR_STOP on
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create schema storage;
create table storage.buckets(id text primary key,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key,bucket_id text,name text,metadata jsonb,updated_at timestamptz);
alter table storage.objects enable row level security;
insert into storage.buckets values('recruit-files',false,10485760,array['application/pdf']);
\ir ../supabase/migrations/202610300001_recruit.sql
\ir ../supabase/migrations/202611040002_news_cms.sql
\ir ../supabase/migrations/202611040003_news_seed.sql
\ir ../supabase/migrations/202611040004_news_numbers.sql
\ir ../supabase/migrations/202611050001_ces_2027_news.sql

insert into public.news_posts(id,slug,post_number,draft,published,published_version,published_at)
values(gen_random_uuid(),'4',4,
 '{"id":"4","date":"2026-11-10","title":{"ko":"ICID 2026","en":"ICID 2026"},"body":{"ko":"Keep this body"}}',
 '{"id":"4","date":"2026-11-10","title":{"ko":"ICID 2026","en":"ICID 2026"},"body":{"ko":"Keep this body"}}',1,now());
insert into public.news_posts(id,slug,post_number,draft)
values(gen_random_uuid(),'private',5,'{"id":"private","date":"2026-11-20","sortDate":"2099-01-01","title":{"ko":"Private draft"}}');
create temp table original_posts as select * from public.news_posts;

\ir ../supabase/migrations/202611200002_news_sort_date.sql

do $$ declare r jsonb; original public.news_posts%rowtype; edited public.news_posts%rowtype; begin
  r:=public.news_public_list();
  if (select array_agg(value->>'id' order by ordinality) from jsonb_array_elements(r) with ordinality)
    <> array['3','4','kimes-busan-2026','website-launch'] then raise exception 'Incorrect public order or draft leaked'; end if;
  select * into original from original_posts where slug='3';
  select * into edited from public.news_posts where slug='3';
  if edited.draft-'sortDate' is distinct from original.draft
    or edited.published-'sortDate' is distinct from original.published
    or edited.id<>original.id or edited.post_number<>original.post_number or edited.published_at<>original.published_at
    or edited.version<>original.version+1 or edited.published_version<>edited.version then
    raise exception 'CES fields or publication state unexpectedly changed'; end if;
  if exists(select 1 from public.news_posts n join original_posts o using(id) where n.slug<>'3' and to_jsonb(n)<>to_jsonb(o)) then
    raise exception 'Another post changed'; end if;
  if public.news_public_list('3')->0->>'date'<>'2026-11-05' then raise exception 'Publication date changed'; end if;
  if not has_function_privilege('service_role','public.news_public_list(text,text,text)','EXECUTE')
    or has_function_privilege('anon','public.news_public_list(text,text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.news_public_list(text,text,text)','EXECUTE') then
    raise exception 'RPC privileges changed'; end if;
end $$;

-- Exercise more than one page, with many equal dates and explicit/default sort keys.
insert into public.news_posts(id,slug,post_number,draft,published,published_version,published_at)
select gen_random_uuid(),slug,i+10,content,content,1,now() from (
  select i,'page-'||i as slug,jsonb_build_object('id','page-'||i,'date','2026-11-15','title',jsonb_build_object('ko','Fixture'))
    || case when i%2=0 then '{"sortDate":"2026-12-01"}'::jsonb else '{}'::jsonb end as content
  from generate_series(1,25) i
) fixtures;
set role service_role;
do $$ declare rows jsonb; last_row jsonb; item jsonb; seen text[]:='{}'; before_date text; before_slug text; begin
  loop
    rows:=public.news_public_list(null,before_date,before_slug);
    for item in select value from jsonb_array_elements(rows) with ordinality where ordinality<=20 loop
      if item->>'id'=any(seen) then raise exception 'Duplicate across pages'; end if;
      if item->>'id'='private' then raise exception 'Draft leaked across pages'; end if;
      seen:=array_append(seen,item->>'id');
    end loop;
    exit when jsonb_array_length(rows)<=20;
    last_row:=rows->19;
    before_date:=coalesce(nullif(last_row->>'sortDate',''),last_row->>'date');
    before_slug:=last_row->>'id';
  end loop;
  if cardinality(seen)<>29 or seen[1]<>'3' then raise exception 'Pagination skipped posts or CES not first'; end if;
end $$;
reset role;

-- Saving a different order remains private until publication; original dates stay intact.
insert into auth.users values('11111111-1111-4111-8111-111111111111');
insert into public.recruit_admins(user_id,active) values('11111111-1111-4111-8111-111111111111',true);
do $$ declare n public.news_posts%rowtype; r jsonb; actor uuid:='11111111-1111-4111-8111-111111111111'; begin
  select * into n from public.news_posts where slug='3';
  r:=public.news_save(actor,n.id,n.version,jsonb_set(n.draft,'{sortDate}','"2025-01-01"'));
  if public.news_public_list()->0->>'id'<>'3' then raise exception 'Draft ordering leaked'; end if;
  perform public.news_publish(actor,n.id,(r->>'version')::integer,true);
  if public.news_public_list()->0->>'id'='3' then raise exception 'Published ordering ignored'; end if;
  if public.news_public_list('3')->0->>'date'<>'2026-11-05' then raise exception 'Editing sort date changed publication date'; end if;
end $$;

-- Rerunning the migration must not reset an administrator's subsequent changes.
create temp table before_rerun as select * from public.news_posts;
\ir ../supabase/migrations/202611200002_news_sort_date.sql
do $$ begin
  if exists(select 1 from public.news_posts n join before_rerun o using(id) where to_jsonb(n)<>to_jsonb(o)) then
    raise exception 'Reapplication changed posts'; end if;
end $$;
select 'Event ordering, date/address preservation, pagination, draft isolation, permissions, and reapplication passed' as result;
