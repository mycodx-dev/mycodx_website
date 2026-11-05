-- READ ONLY. Run as postgres AFTER 202611050002_publications_cms.sql.
begin read only;
-- Expected: one migration row.
select version,applied_at from recruit_private.migrations where version='202611050002_publications_cms';
-- Initially: total=2, published=2, private_drafts=0. Later reflects administrator changes.
select count(*) as total,count(published) as published,
 count(*) filter(where published is null) as private_drafts from public.publications_posts;
select draft->>'title' as title,draft->>'doi' as doi,draft->>'url' as link,
 published is not null as is_published from public.publications_posts order by id desc;
-- Expected: two rows, RLS=true; no direct policies are needed (RPC-only access).
select c.relname,c.relrowsecurity as rls_enabled from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in('publications_posts','publications_audit_logs');
-- Expected: every direct_* field is false for all three roles.
select r.role_name,t.table_id::text,
 has_table_privilege(r.role_name,t.table_id,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as direct_table_access,
 has_any_column_privilege(r.role_name,t.table_id,'SELECT,INSERT,UPDATE,REFERENCES') as direct_column_access,
 has_sequence_privilege(r.role_name,'public.publications_audit_logs_id_seq','USAGE,SELECT,UPDATE') as direct_sequence_access
from (values('anon'),('authenticated'),('service_role'))r(role_name)
cross join (values('public.publications_posts'::regclass),('public.publications_audit_logs'::regclass))t(table_id);
-- Expected: five RPCs, owner=postgres, security_definer=true, search_path="";
-- anon/authenticated=false, server_execute=true. Public listing also passes through the server.
select p.proname,pg_get_userbyid(p.proowner) as owner,p.prosecdef as security_definer,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') as server_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in('publications_admin_list','publications_admin_detail','publications_save','publications_publish','publications_public_list');
-- Expected: false for every role. Private validation helper is not an exposed RPC.
select role_name,has_function_privilege(role_name,'recruit_private.valid_publication(jsonb)','EXECUTE') as helper_execute
from (values('anon'),('authenticated'),('service_role'))r(role_name);
-- Expected: true, true. Does not modify content or invoke a write RPC.
select not exists(select 1 from jsonb_array_elements(public.publications_public_list()) item
 where item ?| array['draft','published','version','published_version','actor_user_id']) as no_private_fields,
 not exists(select 1 from pg_policies where schemaname='public' and tablename in('publications_posts','publications_audit_logs')) as no_direct_policies;
commit;
