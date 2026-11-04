-- READ ONLY. Run as postgres after 202611040004_news_numbers.sql.
begin read only;
select version,applied_at from recruit_private.migrations where version='202611040004_news_numbers';
-- Legacy slug is retained; /news/<post_number> is the canonical address.
select post_number,slug,'/news/'||post_number as public_path,
 draft->'title'->>'ko' as title,published is not null as is_published
from public.news_posts order by post_number;
-- Expected: no rows.
select post_number,count(*) from public.news_posts group by post_number
having count(*)<>1 or post_number is null or post_number<=0;
-- Expected: all three false. No client or service role can allocate numbers directly.
select r.role_name,has_sequence_privilege(r.role_name,'public.news_post_number_seq','USAGE,SELECT,UPDATE') as direct_sequence_access,
 has_any_column_privilege(r.role_name,'public.news_posts','SELECT,INSERT,UPDATE,REFERENCES') as direct_column_access
from (values('anon'),('authenticated'),('service_role'))r(role_name);
-- Expected: RLS=true; anon/authenticated=false; service_role=true for RPCs only.
select relrowsecurity from pg_class where oid='public.news_posts'::regclass;
select p.proname,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') as server_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in('news_admin_list','news_admin_detail','news_save','news_publish','news_public_list');
commit;
