-- Apply once as postgres AFTER 202610300001_recruit. No applicant data changes.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
select pg_advisory_xact_lock(20261030, 1);
do $$ begin
  if current_user <> 'postgres' then raise exception 'Run as postgres'; end if;
  if not exists (select 1 from recruit_private.migrations where version='202610300001_recruit') then raise exception 'Base migration required'; end if;
  if exists (select 1 from recruit_private.migrations where version='202611040001_admin_search') then raise exception 'Already applied'; end if;
end $$;

create function public.recruit_admin_search(p_actor uuid, p_status text default null,
  p_query text default '', p_area text default null, p_experience text default null,
  p_limit integer default 31, p_before_time timestamptz default null, p_before_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare q text := lower(btrim(coalesce(p_query,''))); digits text; result jsonb; options jsonb;
begin
  perform recruit_private.require_admin(p_actor);
  if length(q)>100 or q ~ '[[:cntrl:]]' or length(p_area)>100 or length(p_experience)>100
    or p_limit is null or p_limit not between 1 and 100
    or (p_status is not null and p_status not in ('unread','reviewed'))
    or ((p_before_time is null) <> (p_before_id is null)) then raise exception 'INVALID_FILTER'; end if;
  digits := case when q ~ '^[0-9+() .-]+$' then nullif(regexp_replace(q,'[^0-9]','','g'),'') end;
  -- Literal substring search: %, _ and quotes have no wildcard/SQL meaning.
  select coalesce(jsonb_agg(to_jsonb(x) order by x.submitted_at desc,x.id desc),'[]') into result from (
    select id,name,area,experience,review_status,submitted_at,version from public.recruit_applications
    where stage='submitted' and expires_at>statement_timestamp()
      and (p_status is null or review_status=p_status)
      and (p_area is null or area=p_area) and (p_experience is null or experience=p_experience)
      and (q='' or strpos(lower(name),q)>0 or strpos(lower(email),q)>0 or strpos(lower(phone),q)>0
        or (digits is not null and strpos(regexp_replace(phone,'[^0-9]','','g'),digits)>0))
      and (p_before_time is null or (submitted_at,id)<(p_before_time,p_before_id))
    order by submitted_at desc,id desc limit p_limit
  ) x;
  select jsonb_build_object('areas',coalesce(jsonb_agg(distinct area order by area),'[]'),
    'experiences',coalesce(jsonb_agg(distinct experience order by experience),'[]')) into options
    from public.recruit_applications where stage='submitted' and expires_at>statement_timestamp();
  return jsonb_build_object('items',result,'options',options);
end $$;
revoke all on function public.recruit_admin_search(uuid,text,text,text,text,integer,timestamptz,uuid) from public,anon,authenticated,service_role;
grant execute on function public.recruit_admin_search(uuid,text,text,text,text,integer,timestamptz,uuid) to service_role;
do $$ begin
  if has_function_privilege('anon','public.recruit_admin_search(uuid,text,text,text,text,integer,timestamptz,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.recruit_admin_search(uuid,text,text,text,text,integer,timestamptz,uuid)','EXECUTE') then
    raise exception 'Unexpected inherited function grants'; end if;
end $$;
insert into recruit_private.migrations(version) values('202611040001_admin_search');
notify pgrst,'reload schema';
commit;
