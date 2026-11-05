-- TEST ONLY: psql in a new disposable local database. NEVER run in Supabase.
\set ON_ERROR_STOP on
\ir admin-cms.integration.sql
\ir ../supabase/migrations/202611050002_publications_cms.sql
set role service_role;
do $$
declare actor uuid:='11111111-1111-4111-8111-111111111111'; inactive uuid:='22222222-2222-4222-8222-222222222222';
  post_id uuid:=gen_random_uuid(); other_id uuid:=gen_random_uuid(); draft jsonb; r jsonb; fn text; cursor jsonb;
begin
  r:=public.publications_public_list();
  if jsonb_array_length(r)<>2 or r->0->>'title' not like 'Evaluation of%' then raise exception 'Seed/order mismatch'; end if;
  if r->0->>'url'<>'/papers/evaluation-gcdia-mtb-ntm-real-time-pcr-kit.pdf' then raise exception 'Existing PDF changed'; end if;
  draft:=(r->0)-'id';
  draft:=draft||'{"title":"Test publication","doi":"10.1234/test","year":2027}'::jsonb;
  r:=public.publications_save(actor,post_id,0,draft);
  if jsonb_array_length(public.publications_public_list())<>2 then raise exception 'Draft leaked'; end if;
  begin perform public.publications_save(actor,post_id,0,draft); raise exception 'DUPLICATED'; exception when others then if sqlerrm<>'VERSION_CONFLICT' then raise; end if; end;
  begin perform public.publications_save(actor,other_id,0,draft); raise exception 'DUPLICATE_DOI'; exception when others then if sqlerrm<>'PUBLICATION_DOI_EXISTS' then raise; end if; end;
  perform public.publications_publish(actor,post_id,1,true);
  draft:=draft||'{"title":"PRIVATE_DRAFT"}'::jsonb;
  perform public.publications_save(actor,post_id,2,draft);
  if public.publications_public_list()::text like '%PRIVATE_DRAFT%' then raise exception 'Modified draft leaked'; end if;
  if public.publications_admin_detail(actor,post_id)->'draft'->>'title'<>'PRIVATE_DRAFT' then raise exception 'Saved draft lost'; end if;
  begin perform public.publications_publish(actor,post_id,2,true); raise exception 'STALE_ALLOWED'; exception when others then if sqlerrm<>'VERSION_CONFLICT' then raise; end if; end;
  perform public.publications_publish(actor,post_id,3,true);
  if public.publications_public_list()->0->>'title'<>'PRIVATE_DRAFT' then raise exception 'Republish failed'; end if;
  perform public.publications_publish(actor,post_id,4,false);
  if jsonb_array_length(public.publications_public_list())<>2 then raise exception 'Unpublished leaked'; end if;
  -- Invalid direct RPC input cannot make executable links public.
  begin perform public.publications_save(actor,other_id,0,draft||'{"url":"javascript:alert(1)"}'); raise exception 'BAD_URL_ALLOWED'; exception when others then if sqlerrm<>'INVALID_FIELDS' then raise; end if; end;
  begin perform public.publications_save(actor,other_id,0,draft||'{"year":null}'); raise exception 'BAD_YEAR_ALLOWED'; exception when others then if sqlerrm<>'INVALID_FIELDS' then raise; end if; end;
  begin perform public.publications_save(actor,other_id,0,draft||'{"published":true}'); raise exception 'EXTRA_FIELD_ALLOWED'; exception when others then if sqlerrm<>'INVALID_FIELDS' then raise; end if; end;
  begin perform public.publications_admin_list(inactive); raise exception 'INACTIVE_LIST'; exception when others then if sqlerrm<>'ADMIN_REQUIRED' then raise; end if; end;
  begin perform public.publications_admin_detail(inactive,post_id); raise exception 'INACTIVE_DETAIL'; exception when others then if sqlerrm<>'ADMIN_REQUIRED' then raise; end if; end;
  begin perform public.publications_save(inactive,post_id,5,draft); raise exception 'INACTIVE_SAVE'; exception when others then if sqlerrm<>'ADMIN_REQUIRED' then raise; end if; end;
  begin perform public.publications_publish(inactive,post_id,5,true); raise exception 'INACTIVE_PUBLISH'; exception when others then if sqlerrm<>'ADMIN_REQUIRED' then raise; end if; end;
  for i in 1..24 loop
    other_id:=gen_random_uuid();
    perform public.publications_save(actor,other_id,0,draft||jsonb_build_object('doi','10.1234/page'||i,'title','Paging '||i));
    perform public.publications_publish(actor,other_id,1,true);
  end loop;
  r:=public.publications_public_list();if jsonb_array_length(r)<>21 then raise exception 'Public bound failed'; end if;
  cursor:=r->19;r:=public.publications_public_list((cursor->>'year')::integer,(cursor->>'id')::uuid);
  if jsonb_array_length(r)<>6 then raise exception 'Public cursor failed'; end if;
  r:=public.publications_admin_list(actor);cursor:=r->19;
  if jsonb_array_length(public.publications_admin_list(actor,(cursor->>'updated_at')::timestamptz,(cursor->>'id')::uuid))<>7 then raise exception 'Admin cursor failed'; end if;
end $$;
reset role;
do $$ declare role_name text; t regclass; fn regprocedure; begin
  foreach role_name in array array['anon','authenticated','service_role'] loop
    foreach t in array array['public.publications_posts'::regclass,'public.publications_audit_logs'::regclass] loop
      if not (select relrowsecurity from pg_class where oid=t) then raise exception 'RLS disabled'; end if;
      if has_table_privilege(role_name,t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        or has_any_column_privilege(role_name,t,'SELECT,INSERT,UPDATE,REFERENCES') then raise exception 'Direct access allowed'; end if;
    end loop;
  end loop;
  for fn in select oid::regprocedure from pg_proc where proname like 'publications_%' loop
    if has_function_privilege('anon',fn,'EXECUTE') or has_function_privilege('authenticated',fn,'EXECUTE')
      or not has_function_privilege('service_role',fn,'EXECUTE') then raise exception 'Invalid RPC grants'; end if;
  end loop;
  if (select count(*) from public.publications_audit_logs)<>53 then raise exception 'Invalid audit count'; end if;
end $$;
select 'Publications seed, snapshots, access control, validation, audit and pagination passed' as result;
