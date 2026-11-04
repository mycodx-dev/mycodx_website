-- Apply once as postgres after the base recruitment migration. Seed existing news separately.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(20261030,1);
do $$ begin
  if current_user<>'postgres' then raise exception 'Run as postgres'; end if;
  if not exists(select 1 from recruit_private.migrations where version='202610300001_recruit') then raise exception 'Base migration required'; end if;
  if exists(select 1 from recruit_private.migrations where version='202611040002_news_cms') then raise exception 'Already applied'; end if;
end $$;
create table public.news_posts (
  id uuid primary key,
  slug text not null unique check(length(slug) between 1 and 100 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  draft jsonb not null check(jsonb_typeof(draft)='object' and octet_length(draft::text)<=200000 and draft->>'id'=slug),
  published jsonb check(published is null or (jsonb_typeof(published)='object' and published->>'id'=slug)),
  version integer not null default 1 check(version>0),
  published_version integer,
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  check ((published is null and published_version is null and published_at is null)
    or (published is not null and published_version>0 and published_version<=version and published_at is not null))
);
create table public.news_audit_logs (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.news_posts(id), actor_user_id uuid not null,
  action text not null check(action in ('save','publish','unpublish')), version integer not null,
  created_at timestamptz not null default now()
);
alter table public.news_posts enable row level security;
alter table public.news_audit_logs enable row level security;
revoke all on public.news_posts,public.news_audit_logs from public,anon,authenticated,service_role;
revoke all on sequence public.news_audit_logs_id_seq from public,anon,authenticated,service_role;
create index news_admin_order on public.news_posts(updated_at desc,id desc);
create index news_public_order on public.news_posts((published->>'date') desc,slug desc) where published is not null;

create function public.news_admin_list(p_actor uuid,p_before_time timestamptz default null,p_before_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$ begin
  perform recruit_private.require_admin(p_actor);
  if (p_before_time is null)<>(p_before_id is null) then raise exception 'INVALID_FILTER'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(x) order by updated_at desc,id desc),'[]') from
    (select id,slug,draft->'title'->>'ko' as title,version,published_version,updated_at,published_at
     from public.news_posts where p_before_time is null or (updated_at,id)<(p_before_time,p_before_id)
     order by updated_at desc,id desc limit 21) x);
end $$;
create function public.news_admin_detail(p_actor uuid,p_post_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$ declare result jsonb; begin
  perform recruit_private.require_admin(p_actor);
  select to_jsonb(n)-'published' into result from public.news_posts n where id=p_post_id;
  if result is null then raise exception 'NEWS_NOT_FOUND'; end if;
  return result;
end $$;
create function public.news_save(p_actor uuid,p_post_id uuid,p_version integer,p_draft jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$ declare n public.news_posts%rowtype; begin
  perform recruit_private.require_admin(p_actor);
  if p_post_id is null or p_version is null or p_version<0 or p_draft is null
    or jsonb_typeof(p_draft)<>'object' or coalesce(length(btrim(p_draft->'title'->>'ko')),0)=0
    or coalesce(p_draft->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'INVALID_FIELDS'; end if;
  -- Serialize same UUID creation/retries as well as edits. Slug UNIQUE handles different UUIDs.
  perform pg_advisory_xact_lock(hashtextextended(p_post_id::text,20261104));
  select * into n from public.news_posts where id=p_post_id for update;
  if found then
    if n.version<>p_version then raise exception 'VERSION_CONFLICT'; end if;
    if n.slug is distinct from p_draft->>'id' then raise exception 'NEWS_SLUG_IMMUTABLE'; end if;
    update public.news_posts set draft=p_draft,version=version+1,updated_at=clock_timestamp() where id=p_post_id returning * into n;
  else
    if p_version<>0 then raise exception 'VERSION_CONFLICT'; end if;
    begin
      insert into public.news_posts(id,slug,draft) values(p_post_id,p_draft->>'id',p_draft) returning * into n;
    exception when unique_violation then raise exception 'NEWS_SLUG_EXISTS'; end;
  end if;
  insert into public.news_audit_logs(post_id,actor_user_id,action,version) values(n.id,p_actor,'save',n.version);
  return to_jsonb(n)-'published';
end $$;
create function public.news_publish(p_actor uuid,p_post_id uuid,p_version integer,p_publish boolean)
returns jsonb language plpgsql security definer set search_path='' as $$ declare n public.news_posts%rowtype; begin
  perform recruit_private.require_admin(p_actor);
  select * into n from public.news_posts where id=p_post_id for update;
  if not found then raise exception 'NEWS_NOT_FOUND'; end if;
  if p_version is null or n.version<>p_version then raise exception 'VERSION_CONFLICT'; end if;
  if p_publish is null then raise exception 'INVALID_FIELDS'; end if;
  update public.news_posts set version=version+1,
    published=case when p_publish then draft else null end,
    published_version=case when p_publish then version+1 else null end,
    published_at=case when p_publish then clock_timestamp() else null end,updated_at=clock_timestamp()
    where id=p_post_id returning * into n;
  insert into public.news_audit_logs(post_id,actor_user_id,action,version)
    values(n.id,p_actor,case when p_publish then 'publish' else 'unpublish' end,n.version);
  return to_jsonb(n)-'published';
end $$;
create function public.news_public_list(p_slug text default null,p_before_date text default null,p_before_slug text default null)
returns jsonb language plpgsql security definer set search_path='' as $$ begin
  if p_slug is not null then
    return (select coalesce(jsonb_agg(published),'[]') from public.news_posts where slug=p_slug and published is not null);
  end if;
  if (p_before_date is null)<>(p_before_slug is null) then raise exception 'INVALID_FILTER'; end if;
  return (select coalesce(jsonb_agg(content order by date desc,slug desc),'[]') from (
    select published - array['body','photos','imageAlt','url'] as content,published->>'date' as date,slug
    from public.news_posts where published is not null
      and (p_before_date is null or (published->>'date',slug)<(p_before_date,p_before_slug))
    order by published->>'date' desc,slug desc limit 21
  ) x);
end $$;
do $$ declare fn regprocedure; begin
  for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('news_admin_list','news_admin_detail','news_save','news_publish','news_public_list')
  loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',fn);
    execute format('grant execute on function %s to service_role',fn);
    if has_function_privilege('anon',fn,'EXECUTE') or has_function_privilege('authenticated',fn,'EXECUTE') then raise exception 'Unexpected inherited grants'; end if;
  end loop;
  if exists(select 1 from (values ('anon'),('authenticated'),('service_role')) r(role_name)
    cross join (values ('public.news_posts'::regclass),('public.news_audit_logs'::regclass)) t(table_id)
    where has_table_privilege(r.role_name,t.table_id,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      or has_any_column_privilege(r.role_name,t.table_id,'SELECT,INSERT,UPDATE,REFERENCES')) then raise exception 'Unexpected inherited table grants'; end if;
end $$;
insert into recruit_private.migrations(version) values('202611040002_news_cms');
notify pgrst,'reload schema';
commit;
