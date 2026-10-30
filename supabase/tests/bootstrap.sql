-- LOCAL EMPTY TEST DATABASE ONLY. Never run in Supabase SQL Editor.
do $$ begin
  if current_database() <> 'mycodx_recruit_test' then raise exception 'LOCAL_TEST_DATABASE_REQUIRED'; end if;
end $$;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public to anon,authenticated,service_role;
-- Reproduce Supabase's broad initial grants; migration must explicitly remove them.
alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
create schema auth;
create table auth.users(id uuid primary key);
create schema storage;
create table storage.buckets(id text primary key, public boolean not null,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),
  name text,metadata jsonb,updated_at timestamptz default now(),unique(bucket_id,name));
alter table storage.objects enable row level security;
grant usage on schema storage to anon,authenticated,service_role;
grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
create policy existing_broad_policy on storage.objects for all to anon,authenticated using(true) with check(true);
insert into storage.buckets values('recruit-files',false,10485760,
  array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/zip']);
insert into storage.buckets values('unrelated-bucket',false,null,null);
insert into auth.users values('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
