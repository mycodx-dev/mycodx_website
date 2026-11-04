-- READ ONLY. Run as postgres after the three 20261104 migrations.
begin read only;
-- Expected: all three versions, one row each.
select version,applied_at from recruit_private.migrations where version like '20261104%' order by version;
-- Expected: both rows rls_enabled=true. No direct table access for any API role.
select c.relname,c.relrowsecurity as rls_enabled,r.role_name,
 has_table_privilege(r.role_name,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as direct_table_access,
 has_any_column_privilege(r.role_name,c.oid,'SELECT,INSERT,UPDATE,REFERENCES') as direct_column_access
from pg_class c join pg_namespace n on n.oid=c.relnamespace
cross join (values('anon'),('authenticated'),('service_role'))r(role_name)
where n.nspname='public' and c.relname in ('news_posts','news_audit_logs');
-- Expected: postgres owner, security_definer=true, empty search_path;
-- anon_execute=false, authenticated_execute=false, server_execute=true.
select p.proname,pg_get_userbyid(p.proowner) as owner,p.prosecdef as security_definer,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') as server_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 and p.proname in ('recruit_admin_search','news_admin_list','news_admin_detail','news_save','news_publish','news_public_list') order by p.proname;
-- Immediately after seeding: total=2, published=2, private_drafts=0.
-- Counts change normally when editors save/publish/unpublish posts.
select count(*) as total,count(*) filter(where published is not null) as published,
 count(*) filter(where published is null) as private_drafts from public.news_posts;
select action,count(*) from public.news_audit_logs group by action;
commit;
