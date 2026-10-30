-- READ ONLY. Run as postgres after applying the migration.
-- No candidate fields, keys, passwords or file paths are printed.
begin read only;

-- Expected: one marker row. A second migration run must fail safely.
select version, applied_at from recruit_private.migrations;

-- Expected: true. The private migration ledger also has RLS enabled.
select relrowsecurity as migration_ledger_rls_enabled
from pg_class where oid = 'recruit_private.migrations'::regclass;

-- Expected: exactly five tables; every rls_enabled=true.
select c.relname, c.relrowsecurity as rls_enabled, pg_get_userbyid(c.relowner) as owner
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'recruit\_%' escape '\'
order by c.relname;

-- Expected: zero rows. Checks effective grants, including inherited/PUBLIC grants.
select r.role_name, t.table_name, v.privilege
from (values ('anon'),('authenticated'),('service_role')) r(role_name)
cross join (values ('recruit_admins'),('recruit_applications'),('recruit_application_files'),
  ('recruit_notifications'),('recruit_audit_logs')) t(table_name)
cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) v(privilege)
where has_table_privilege(r.role_name,'public.'||t.table_name,v.privilege);

-- Expected: zero rows, including any separately granted column privileges.
select r.role_name,c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
cross join (values ('anon'),('authenticated'),('service_role')) r(role_name)
where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'recruit\_%' escape '\'
  and has_any_column_privilege(r.role_name,c.oid,'SELECT, INSERT, UPDATE, REFERENCES');

-- Expected: zero rows. No browser read/write policies on these tables.
select * from pg_policies where schemaname = 'public' and tablename like 'recruit\_%' escape '\';

-- Expected: each RPC has server_execute=true, anon/auth=false, SECURITY DEFINER,
-- postgres owner, search_path="". An unexpected overload/name needs review.
select p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer, pg_get_userbyid(p.proowner) as owner, p.proconfig,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') as server_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'recruit\_%' escape '\' order by p.proname;

-- Expected: zero rows. Helpers and migration metadata must not be exposed.
select r.role_name, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
cross join (values ('anon'),('authenticated'),('service_role')) r(role_name)
where n.nspname = 'recruit_private' and has_function_privilege(r.role_name,p.oid,'EXECUTE');
select r, has_schema_privilege(r,'recruit_private','USAGE') as private_schema_access
from unnest(array['anon','authenticated','service_role']) r;

-- Expected: private bucket; one restrictive ALL policy for anon/authenticated.
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'recruit-files';
select policyname, permissive, roles, cmd, qual, with_check from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname = 'recruit_files_server_only';

-- Expected: all zero. These checks do not reveal personal data.
select
  (select count(*) from public.recruit_applications a where a.stage = 'submitted'
    and not exists(select 1 from public.recruit_notifications n where n.application_id = a.id)) as missing_notifications,
  (select count(*) from public.recruit_notifications n join public.recruit_applications a on a.id = n.application_id
    where a.stage = 'staging') as premature_notifications,
  (select count(*) from public.recruit_applications a where a.stage = 'submitted'
    and a.expires_at <> ((a.submitted_at at time zone 'UTC') + interval '1 year') at time zone 'UTC') as wrong_retention;

-- These counts may be nonzero in normal use; inspect operationally, not by exposing data.
select status,count(*) from public.recruit_notifications group by status;
select count(*) as expired_applications_waiting_for_cleanup
from public.recruit_applications where stage = 'submitted' and expires_at <= now();
commit;
