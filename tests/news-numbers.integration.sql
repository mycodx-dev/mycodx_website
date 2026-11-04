-- LOCAL DISPOSABLE DATABASE ONLY. Run after admin-cms.integration.sql.
\set ON_ERROR_STOP on
-- Preserve an existing numeric alias and reserve it before numbering other posts.
insert into public.news_posts(id,slug,draft) values(gen_random_uuid(),'9',
 '{"id":"9","date":"2026-11-04","title":{"ko":"Reserved alias"},"summary":{"ko":""}}');
\ir ../supabase/migrations/202611040004_news_numbers.sql
set role service_role;
do $$
declare actor uuid:='11111111-1111-4111-8111-111111111111';
 post_id uuid:=gen_random_uuid(); draft jsonb; r jsonb; number integer; alias text; existing_id uuid; old_version integer;
begin
  -- Only published snapshots are exposed through both old and numeric addresses.
  r:=public.news_public_list('website-launch')->0;
  number:=(r->>'postNumber')::integer;
  if number is null or public.news_public_list(number::text)->0 is distinct from r then raise exception 'Alias mismatch'; end if;
  if jsonb_array_length(public.news_public_list('9'))<>0 then raise exception 'Private numeric alias leaked'; end if;
  existing_id:=(public.news_admin_list(actor)->0->>'id')::uuid;
  if (public.news_admin_detail(actor,existing_id)->>'post_number') is null then raise exception 'Admin number missing'; end if;
  draft:='{"id":"attempt-to-set-address","date":"2026-11-04","title":{"ko":"New draft"},"summary":{"ko":""},"body":{"ko":"PRIVATE"}}';
  r:=public.news_save(actor,post_id,0,draft);
  number:=(r->>'post_number')::integer; alias:=r->>'slug';
  if number<=9 or alias<>number::text or r->'draft'->>'id'<>alias then raise exception 'Number not server assigned'; end if;
  if jsonb_array_length(public.news_public_list(alias))<>0 then raise exception 'Draft leaked by number'; end if;
  begin perform public.news_save(actor,post_id,0,draft); raise exception 'RETRY_DUPLICATED';
    exception when others then if sqlerrm<>'VERSION_CONFLICT' then raise; end if; end;
  r:=public.news_publish(actor,post_id,1,true);
  if public.news_public_list(alias)->0->'body'->>'ko'<>'PRIVATE' then raise exception 'Published detail missing'; end if;
  draft:=jsonb_set(r->'draft','{title,ko}','"Edited title"');
  r:=public.news_save(actor,post_id,2,draft);
  if (r->>'post_number')::integer<>number or r->>'slug'<>alias then raise exception 'Address changed on edit'; end if;
  if public.news_public_list(alias)->0->'title'->>'ko'<>'New draft' then raise exception 'Unpublished edit leaked'; end if;
  r:=public.news_publish(actor,post_id,3,false);
  if jsonb_array_length(public.news_public_list(alias))<>0 then raise exception 'Unpublished number accessible'; end if;
  -- Legacy aliases are immutable when editing and keep their numeric address too.
  for r in select value from jsonb_array_elements(public.news_admin_list(actor)) loop
    if r->>'slug'='website-launch' then existing_id:=(r->>'id')::uuid; old_version:=(r->>'version')::integer; end if;
  end loop;
  r:=public.news_admin_detail(actor,existing_id);
  draft:=jsonb_set(r->'draft','{title,ko}','"Legacy edited draft"');
  r:=public.news_save(actor,existing_id,old_version,draft);
  if r->>'slug'<>'website-launch' then raise exception 'Legacy alias lost'; end if;
  if public.news_public_list('website-launch')->0->'title'->>'ko'='Legacy edited draft' then raise exception 'Legacy draft leaked'; end if;
  begin perform public.news_save('22222222-2222-4222-8222-222222222222',gen_random_uuid(),0,draft); raise exception 'INACTIVE_ALLOWED';
    exception when others then if sqlerrm<>'ADMIN_REQUIRED' then raise; end if; end;
end $$;
reset role;
do $$ declare role_name text; highest integer; assigned integer; begin
  foreach role_name in array array['anon','authenticated','service_role'] loop
    if has_sequence_privilege(role_name,'public.news_post_number_seq','USAGE,SELECT,UPDATE') then raise exception 'Sequence access allowed'; end if;
    if has_any_column_privilege(role_name,'public.news_posts','SELECT,INSERT,UPDATE,REFERENCES') then raise exception 'Column access allowed'; end if;
  end loop;
  select max(post_number) into highest from public.news_posts;
  -- Deletion does not make a number available again.
  delete from public.news_audit_logs where post_id in(select id from public.news_posts where post_number=highest);
  delete from public.news_posts where post_number=highest;
  assigned:=nextval('public.news_post_number_seq');
  if assigned<=highest then raise exception 'Number reused'; end if;
  if (select post_number from public.news_posts where slug='9')<>9 then raise exception 'Numeric alias changed'; end if;
end $$;
select 'Permanent numbers, aliases, draft isolation, access control, edit/retry and deletion checks passed' as result;
