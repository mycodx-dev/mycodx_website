-- READ ONLY. Run as postgres before applying the migration. No secret values.
begin read only;
select current_user, current_database(), version();

-- Expected: no rows. Existing objects mean STOP and inspect; never drop to retry.
select n.nspname as schema_name, c.relname as object_name, c.relkind
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'recruit_private'
   or (n.nspname = 'public' and c.relname like 'recruit\_%' escape '\');

select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'recruit_private'
   or (n.nspname = 'public' and p.proname like 'recruit\_%' escape '\');

-- Expected: one row, public=false. Set limit=10485760 and four allowed MIME
-- types in Storage dashboard/API; this script does NOT edit managed tables.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'recruit-files';

-- Review existing broad policies. The new restrictive policy blocks direct
-- anon/authenticated access to recruit-files even if another permissive policy allows it.
select policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname = 'storage' and tablename = 'objects';

select rolname, rolbypassrls from pg_roles
where rolname in ('postgres','anon','authenticated','service_role');
select pg_get_userbyid(d.defaclrole) as owner, n.nspname, d.defaclobjtype, d.defaclacl
from pg_default_acl d left join pg_namespace n on n.oid = d.defaclnamespace;
commit;
