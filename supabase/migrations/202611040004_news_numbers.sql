-- Apply as postgres after the existing news CMS and seed migrations.
-- Add permanent public numbers; keep old slugs as aliases and never reset sequence.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(20261030,1);
do $$ begin
  if current_user<>'postgres' then raise exception 'Run as postgres'; end if;
  if not exists(select 1 from recruit_private.migrations where version='202611040003_news_seed') then raise exception 'News CMS and seed migrations required'; end if;
  if exists(select 1 from recruit_private.migrations where version='202611040004_news_numbers') then raise exception 'Already applied'; end if;
end $$;
lock table public.news_posts in access exclusive mode;
create sequence public.news_post_number_seq as integer;
alter table public.news_posts add column post_number integer;
-- Preserve any existing canonical numeric addresses before allocating other numbers.
update public.news_posts set post_number=slug::integer
where slug ~ '^[1-9][0-9]{0,9}$' and length(slug)<=10 and case when slug ~ '^[1-9][0-9]{0,9}$' then slug::numeric<=2147483647 else false end;
with numbered as (
  select id, row_number() over(order by draft->>'date',slug,id)
    + coalesce((select max(post_number) from public.news_posts),0) as number
  from public.news_posts where post_number is null
)
update public.news_posts p set post_number=n.number from numbered n where p.id=n.id;
alter table public.news_posts alter column post_number set not null;
alter table public.news_posts add constraint news_posts_post_number_key unique(post_number);
alter table public.news_posts add constraint news_posts_post_number_positive check(post_number>0);
alter sequence public.news_post_number_seq owned by public.news_posts.post_number;
select setval('public.news_post_number_seq',coalesce(max(post_number),1),count(*)>0) from public.news_posts;
alter table public.news_posts alter column post_number set default nextval('public.news_post_number_seq');
revoke all on sequence public.news_post_number_seq from public,anon,authenticated,service_role;

create or replace function public.news_admin_list(p_actor uuid,p_before_time timestamptz default null,p_before_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$ begin
  perform recruit_private.require_admin(p_actor);
  if (p_before_time is null)<>(p_before_id is null) then raise exception 'INVALID_FILTER'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(x) order by updated_at desc,id desc),'[]') from
    (select id,slug,post_number,draft->'title'->>'ko' as title,version,published_version,updated_at,published_at
     from public.news_posts where p_before_time is null or (updated_at,id)<(p_before_time,p_before_id)
     order by updated_at desc,id desc limit 21) x);
end $$;
create or replace function public.news_save(p_actor uuid,p_post_id uuid,p_version integer,p_draft jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$ declare n public.news_posts%rowtype; number integer; begin
  perform recruit_private.require_admin(p_actor);
  if p_post_id is null or p_version is null or p_version<0 or p_draft is null
    or jsonb_typeof(p_draft)<>'object' or coalesce(length(btrim(p_draft->'title'->>'ko')),0)=0
    or coalesce(p_draft->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'INVALID_FIELDS'; end if;
  -- Serialize same UUID creation/retries as well as edits. Slug UNIQUE handles different UUIDs.
  perform pg_advisory_xact_lock(hashtextextended(p_post_id::text,20261104));
  select * into n from public.news_posts where id=p_post_id for update;
  if found then
    if n.version<>p_version then raise exception 'VERSION_CONFLICT'; end if;
    if nullif(p_draft->>'id','') is not null and n.slug is distinct from p_draft->>'id' then raise exception 'NEWS_SLUG_IMMUTABLE'; end if;
    update public.news_posts set draft=jsonb_set(p_draft,'{id}',to_jsonb(n.slug)),version=version+1,updated_at=clock_timestamp() where id=p_post_id returning * into n;
  else
    if p_version<>0 then raise exception 'VERSION_CONFLICT'; end if;
    -- The DB allocates the address. Ignore a supplied ID on a new draft.
    number:=nextval('public.news_post_number_seq');
    insert into public.news_posts(id,slug,post_number,draft)
      values(p_post_id,number::text,number,jsonb_set(p_draft,'{id}',to_jsonb(number::text))) returning * into n;
  end if;
  insert into public.news_audit_logs(post_id,actor_user_id,action,version) values(n.id,p_actor,'save',n.version);
  return to_jsonb(n)-'published';
end $$;
create or replace function public.news_public_list(p_slug text default null,p_before_date text default null,p_before_slug text default null)
returns jsonb language plpgsql security definer set search_path='' as $$ begin
  if p_slug is not null then
    return (select coalesce(jsonb_agg(published || jsonb_build_object('postNumber',post_number)),'[]') from public.news_posts where (slug=p_slug or post_number::text=p_slug) and published is not null);
  end if;
  if (p_before_date is null)<>(p_before_slug is null) then raise exception 'INVALID_FILTER'; end if;
  return (select coalesce(jsonb_agg(content order by date desc,slug desc),'[]') from (
    select (published - array['body','photos','imageAlt','url']) || jsonb_build_object('postNumber',post_number) as content,published->>'date' as date,slug
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
insert into recruit_private.migrations(version) values('202611040004_news_numbers');
notify pgrst,'reload schema';
commit;
