-- TEST ONLY: run with psql against a NEW disposable local database.
-- Creates fake Supabase schemas/roles. NEVER run in Supabase SQL Editor.
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
\ir ../supabase/migrations/202611040001_admin_search.sql
\ir ../supabase/migrations/202611040002_news_cms.sql
\ir ../supabase/migrations/202611040003_news_seed.sql

insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.recruit_admins(user_id,active) values('11111111-1111-4111-8111-111111111111',true),('22222222-2222-4222-8222-222222222222',false);
-- A result beyond the first page, plus expired/staging rows that must never appear.
insert into public.recruit_applications(id,idempotency_key_hash,payload_hash,name,email,phone,area,education,experience,language,consent,consent_version,stage,submitted_at,expires_at)
select gen_random_uuid(),lpad(i::text,64,'0'),repeat('a',64),case when i=35 then '찾을 지원자' else '가상 지원자 '||i end,
 'person'||i||'@example.test','010-1234-5678',case when i=35 then '영업' else '연구' end,'학사',case when i=35 then '경력' else '신입' end,
 'ko',true,'test-v1','submitted',now()-i*interval '1 minute',now()+interval '1 year' from generate_series(1,35)i;
insert into public.recruit_applications(id,idempotency_key_hash,payload_hash,name,email,phone,area,education,experience,language,consent,consent_version,stage,submitted_at,expires_at)
values(gen_random_uuid(),repeat('f',64),repeat('b',64),'만료된 지원자','expired@example.test','010-9999-9999','만료 분야','학사','신입','ko',true,'test-v1','submitted',now()-interval '2 years',now()-interval '1 day');
insert into public.recruit_applications(id,idempotency_key_hash,payload_hash,name,email,phone,area,education,experience,language,consent,consent_version)
values(gen_random_uuid(),repeat('e',64),repeat('b',64),'미완료 지원자','staging@example.test','010-9999-9999','미완료 분야','학사','신입','ko',true,'test-v1');
set role service_role;
do $$ declare actor uuid:='11111111-1111-4111-8111-111111111111'; r jsonb; n integer; last_row jsonb; begin
  r:=public.recruit_admin_search(actor,p_query=>'person35',p_area=>'영업',p_experience=>'경력',p_status=>'unread');
  if jsonb_array_length(r->'items')<>1 or r->'items'->0->>'name'<>'찾을 지원자' then raise exception 'Cross-page search failed'; end if;
  if r->'options'->'areas' ? '만료 분야' or r->'options'->'areas' ? '미완료 분야' then raise exception 'Hidden metadata leak'; end if;
  if jsonb_array_length(public.recruit_admin_search(actor,p_query=>'%')->'items')<>0 then raise exception 'Wildcard interpreted'; end if;
  if jsonb_array_length(public.recruit_admin_search(actor,p_query=>'01012345678')->'items')<>31 then raise exception 'Normalized phone search failed'; end if;
  r:=public.recruit_admin_search(actor,p_limit=>30); last_row:=r->'items'->29;
  r:=public.recruit_admin_search(actor,p_before_time=>(last_row->>'submitted_at')::timestamptz,p_before_id=>(last_row->>'id')::uuid);
  if jsonb_array_length(r->'items')<>5 then raise exception 'Pagination failed'; end if;
  begin perform public.recruit_admin_search('22222222-2222-4222-8222-222222222222'); raise exception 'INACTIVE_ALLOWED';
    exception when others then if sqlerrm<>'ADMIN_REQUIRED' then raise; end if; end;
end $$;
do $$ declare actor uuid:='11111111-1111-4111-8111-111111111111'; post_id uuid:=gen_random_uuid(); r jsonb; draft jsonb; before_count integer; begin
  before_count:=jsonb_array_length(public.news_public_list());
  if before_count<>2 then raise exception 'Existing news seed mismatch'; end if;
  draft:='{"id":"test-news","date":"2026-11-04","title":{"ko":"첫 공개 제목","en":""},"summary":{"ko":"요약","en":""},"body":{"ko":"PRIVATE_DRAFT","en":""},"visible":true}'::jsonb;
  r:=public.news_save(actor,post_id,0,draft);
  if jsonb_array_length(public.news_public_list('test-news'))<>0 then raise exception 'Draft leaked'; end if;
  begin perform public.news_save(actor,post_id,0,draft); raise exception 'RETRY_DUPLICATED';
    exception when others then if sqlerrm<>'VERSION_CONFLICT' then raise; end if; end;
  begin perform public.news_save(actor,gen_random_uuid(),0,draft); raise exception 'DUPLICATE_SLUG';
    exception when others then if sqlerrm<>'NEWS_SLUG_EXISTS' then raise; end if; end;
  r:=public.news_publish(actor,post_id,1,true);
  if jsonb_array_length(public.news_public_list('test-news'))<>1 then raise exception 'Publish missing'; end if;
  draft:=jsonb_set(draft,'{title,ko}','"아직 공개하면 안 되는 수정 제목"');
  r:=public.news_save(actor,post_id,2,draft);
  if public.news_public_list('test-news')->0->'title'->>'ko'<>'첫 공개 제목' then raise exception 'Draft changed publication'; end if;
  begin perform public.news_publish(actor,post_id,2,true); raise exception 'STALE_PUBLISH_ALLOWED';
    exception when others then if sqlerrm<>'VERSION_CONFLICT' then raise; end if; end;
  r:=public.news_publish(actor,post_id,3,true);
  if public.news_public_list('test-news')->0->'title'->>'ko'<>'아직 공개하면 안 되는 수정 제목' then raise exception 'Republish missing'; end if;
  r:=public.news_publish(actor,post_id,4,false);
  if jsonb_array_length(public.news_public_list('test-news'))<>0 then raise exception 'Unpublished leaked'; end if;
  begin perform public.news_admin_list('22222222-2222-4222-8222-222222222222'); raise exception 'INACTIVE_NEWS_ALLOWED';
    exception when others then if sqlerrm<>'ADMIN_REQUIRED' then raise; end if; end;
end $$;
reset role;
do $$ declare role_name text; t regclass; p regprocedure; begin
  foreach role_name in array array['anon','authenticated','service_role'] loop
    foreach t in array array['public.news_posts'::regclass,'public.news_audit_logs'::regclass] loop
      if has_table_privilege(role_name,t,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'Direct access allowed'; end if;
    end loop;
  end loop;
  for p in select oid::regprocedure from pg_proc where proname like 'news_%' or proname='recruit_admin_search' loop
    if has_function_privilege('anon',p,'EXECUTE') or has_function_privilege('authenticated',p,'EXECUTE') then raise exception 'Public RPC access allowed'; end if;
  end loop;
  if (select count(*) from public.news_audit_logs)<>5 then raise exception 'Unexpected audit count'; end if;
end $$;
select 'Search, publication isolation, role permissions and optimistic concurrency passed' as result;
