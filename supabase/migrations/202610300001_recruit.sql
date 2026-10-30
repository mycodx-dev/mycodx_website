-- Apply ONCE, as postgres, in Supabase SQL Editor. No Storage object mutations.
-- Re-running or finding an earlier draft fails before changing anything.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
select pg_advisory_xact_lock(20261030, 1);

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Run this migration as postgres';
  end if;
  if exists (select 1 from pg_namespace where nspname = 'recruit_private')
     or exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname like 'recruit\_%' escape '\')
     or exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname like 'recruit\_%' escape '\')
     or exists (select 1 from pg_policies where schemaname = 'storage'
       and tablename = 'objects' and policyname = 'recruit_files_server_only') then
    raise exception 'Recruit objects already exist: inspect migration history; do not drop data or rerun';
  end if;
  if not exists (select 1 from storage.buckets where id = 'recruit-files' and public = false) then
    raise exception 'Create/confirm PRIVATE recruit-files bucket in Storage dashboard first';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass) then
    raise exception 'storage.objects must already have RLS enabled';
  end if;
end $$;

create schema recruit_private authorization postgres;
revoke all on schema recruit_private from public, anon, authenticated, service_role;
create table recruit_private.migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);
alter table recruit_private.migrations enable row level security;
revoke all on recruit_private.migrations from public, anon, authenticated, service_role;

-- Private helpers are not exposed through PostgREST.
create function recruit_private.clean_text(v jsonb, max_length integer,
  required boolean default true, multiline boolean default false)
returns text language plpgsql immutable set search_path = '' as $$
declare s text;
begin
  if v is null or jsonb_typeof(v) <> 'string' then raise exception 'INVALID_FIELDS'; end if;
  s := btrim(v #>> '{}');
  if length(s) > max_length or (required and s = '')
     or replace(replace(replace(s, chr(9), ''), chr(10), ''), chr(13), '') ~ '[[:cntrl:]]'
     or (not multiline and (strpos(s, chr(10)) > 0 or strpos(s, chr(13)) > 0)) then
    raise exception 'INVALID_FIELDS';
  end if;
  return s;
end $$;

create function recruit_private.valid_email(v text) returns boolean
language sql immutable set search_path = '' as $$
  select v is not null and length(v) between 3 and 254
    and v !~ '[[:cntrl:]]'
    and v ~ '^[^[:space:]@<>(),;:"\\]+@[^[:space:]@<>(),;:"\\]+\.[^[:space:]@<>(),;:"\\]+$';
$$;

create table public.recruit_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.recruit_applications (
  id uuid primary key,
  idempotency_key_hash text not null unique check (idempotency_key_hash ~ '^[0-9a-f]{64}$'),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  name varchar(100) not null check (btrim(name) <> ''),
  email varchar(254) not null check (recruit_private.valid_email(email)),
  phone varchar(40) not null check (btrim(phone) <> ''),
  area varchar(100) not null check (btrim(area) <> ''),
  education varchar(100) not null check (btrim(education) <> ''),
  experience varchar(100) not null check (btrim(experience) <> ''),
  message varchar(1000) not null default '',
  language text not null check (language in ('ko', 'en', 'ja', 'fr')),
  consent boolean not null check (consent),
  consented_at timestamptz not null default now(),
  consent_version varchar(100) not null check (btrim(consent_version) <> ''),
  stage text not null default 'staging' check (stage in ('staging', 'submitted', 'purging')),
  review_status text not null default 'unread' check (review_status in ('unread', 'reviewed')),
  reviewed_at timestamptz,
  reviewed_by uuid,
  version integer not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  staging_expires_at timestamptz not null default (now() + interval '24 hours'),
  submitted_at timestamptz,
  expires_at timestamptz,
  check ((review_status = 'unread' and reviewed_at is null and reviewed_by is null)
    or (review_status = 'reviewed' and reviewed_at is not null and reviewed_by is not null)),
  check ((submitted_at is null and expires_at is null)
    or (submitted_at is not null and expires_at is not null and expires_at > submitted_at)),
  check (stage <> 'submitted' or submitted_at is not null),
  check (stage <> 'staging' or submitted_at is null)
);

create table public.recruit_application_files (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.recruit_applications(id) on delete cascade,
  slot smallint not null check (slot between 0 and 9),
  file_group text not null check (file_group in ('application', 'degree', 'transcript', 'papers')),
  original_name varchar(180) not null check (btrim(original_name) <> ''
    and left(original_name, 1) <> '.' and strpos(original_name, '/') = 0
    and strpos(original_name, chr(92)) = 0 and original_name !~ '[[:cntrl:]]'),
  extension text not null check (extension in ('pdf', 'doc', 'docx', 'zip')),
  content_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  bucket_id text not null default 'recruit-files' check (bucket_id = 'recruit-files'),
  object_path text not null unique,
  storage_status text not null default 'pending' check (storage_status in ('pending', 'ready')),
  storage_object_id uuid,
  storage_updated_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique(application_id, slot),
  check ((file_group = 'application' and extension in ('pdf', 'doc', 'docx'))
    or (file_group <> 'application' and extension in ('pdf', 'zip'))),
  check (content_type = case extension when 'pdf' then 'application/pdf'
    when 'doc' then 'application/msword'
    when 'docx' then 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    when 'zip' then 'application/zip' end),
  check (object_path = 'v1/' || application_id::text || '/' || id::text || '.' || extension),
  check (storage_status <> 'ready' or (sha256 is not null and verified_at is not null
    and storage_object_id is not null and storage_updated_at is not null))
);
create unique index recruit_one_application_file on public.recruit_application_files(application_id)
  where file_group = 'application';

create table public.recruit_notifications (
  application_id uuid primary key references public.recruit_applications(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'accepted', 'failed', 'uncertain', 'paused')),
  provider text check (provider in ('smtp', 'resend')),
  recipient varchar(254) not null check (recruit_private.valid_email(recipient)),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  claim_token uuid,
  started_at timestamptz,
  finished_at timestamptz,
  provider_message_id varchar(1000),
  last_error_code text check (last_error_code in
    ('CONFIGURATION', 'FILE_UNAVAILABLE', 'DEFINITELY_REJECTED', 'NETWORK_UNCERTAIN', 'WORKER_TIMEOUT')),
  created_at timestamptz not null default now(),
  check (status <> 'sending' or (claim_token is not null and started_at is not null and provider is not null)),
  check (status <> 'accepted' or (provider_message_id is not null and btrim(provider_message_id) <> ''
    and finished_at is not null))
);

create table public.recruit_audit_logs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.recruit_applications(id) on delete cascade,
  actor_user_id uuid not null,
  action text not null check (action in ('view_detail', 'download_url_issued', 'mark_reviewed', 'mark_unread')),
  file_id uuid,
  signed_url_ttl_seconds smallint check (signed_url_ttl_seconds between 1 and 60),
  created_at timestamptz not null default now()
);

create index recruit_list_idx on public.recruit_applications(submitted_at desc, id desc) where stage = 'submitted';
create index recruit_review_idx on public.recruit_applications(review_status, submitted_at desc, id desc) where stage = 'submitted';
create index recruit_expiry_idx on public.recruit_applications(expires_at) where stage = 'submitted';
create index recruit_staging_idx on public.recruit_applications(staging_expires_at) where stage = 'staging';
create index recruit_pending_idx on public.recruit_notifications(created_at) where status = 'pending';
create index recruit_audit_idx on public.recruit_audit_logs(application_id, created_at desc);

-- Exact table ACLs: even service_role uses RPC, not direct table CRUD.
alter table public.recruit_admins enable row level security;
alter table public.recruit_applications enable row level security;
alter table public.recruit_application_files enable row level security;
alter table public.recruit_notifications enable row level security;
alter table public.recruit_audit_logs enable row level security;
revoke all on table public.recruit_admins, public.recruit_applications,
  public.recruit_application_files, public.recruit_notifications, public.recruit_audit_logs
  from public, anon, authenticated, service_role;

create policy recruit_files_server_only on storage.objects as restrictive
  for all to anon, authenticated
  using (bucket_id <> 'recruit-files') with check (bucket_id <> 'recruit-files');

create function recruit_private.require_admin(p_actor uuid) returns void
language plpgsql set search_path = '' as $$
begin
  perform 1 from public.recruit_admins where user_id = p_actor and active for share;
  if not found then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
end $$;

create function recruit_private.require_visible(p_id uuid) returns void
language plpgsql set search_path = '' as $$
begin
  perform 1 from public.recruit_applications where id = p_id
    and stage = 'submitted' and expires_at > clock_timestamp() for share;
  if not found then raise exception 'APPLICATION_NOT_AVAILABLE'; end if;
end $$;

-- Caller supplies the existing Vercel submission UUID and a SHA-256 of a random
-- idempotency key persisted BEFORE start. The hash is not an authorization token.
create function public.recruit_begin_application(p_id uuid, p_idempotency_key_hash text,
  p_fields jsonb, p_files jsonb, p_language text, p_consent boolean, p_consent_version text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a public.recruit_applications%rowtype;
  fields jsonb; files jsonb := '[]'; item jsonb; filename text; ext text;
  group_name text; bytes bigint; total bigint := 0; file_id uuid; slot_no integer := 0;
  payload text; v_name text; v_email text; v_phone text; v_area text; v_education text;
  v_experience text; v_message text;
begin
  if p_id is null or p_idempotency_key_hash is null or p_idempotency_key_hash !~ '^[0-9a-f]{64}$'
    or p_consent is distinct from true or p_language is null or p_language not in ('ko','en','ja','fr')
    or p_consent_version is null or length(btrim(p_consent_version)) not between 1 and 100
    or jsonb_typeof(p_fields) is distinct from 'object'
    or jsonb_typeof(p_files) is distinct from 'array' then raise exception 'INVALID_FIELDS'; end if;
  if jsonb_array_length(p_files) not between 3 and 10 then raise exception 'FILES_REQUIRED'; end if;
  v_name := recruit_private.clean_text(p_fields->'name',100);
  v_email := recruit_private.clean_text(p_fields->'email',254);
  v_phone := recruit_private.clean_text(p_fields->'phone',40);
  v_area := recruit_private.clean_text(p_fields->'area',100);
  v_education := recruit_private.clean_text(p_fields->'education',100);
  v_experience := recruit_private.clean_text(p_fields->'experience',100);
  v_message := recruit_private.clean_text(p_fields->'message',1000,false,true);
  if not recruit_private.valid_email(v_email) then raise exception 'INVALID_EMAIL'; end if;
  fields := jsonb_build_object('name',v_name,'email',v_email,'phone',v_phone,'area',v_area,
    'education',v_education,'experience',v_experience,'message',v_message);
  for item in select value from jsonb_array_elements(p_files) loop
    filename := recruit_private.clean_text(item->'name',180);
    group_name := item->>'group';
    ext := lower(substring(filename from '\.([^.]+)$'));
    if group_name is null or group_name not in ('application','degree','transcript','papers')
      or left(filename,1) = '.' or strpos(filename,'/') > 0 or strpos(filename,chr(92)) > 0
      or filename ~ '[[:cntrl:]]' or ext is null
      or (group_name = 'application' and ext not in ('pdf','doc','docx'))
      or (group_name <> 'application' and ext not in ('pdf','zip'))
      or jsonb_typeof(item->'size') is distinct from 'number'
      or (item->>'size') !~ '^[0-9]{1,8}$' then raise exception 'INVALID_FILE'; end if;
    bytes := (item->>'size')::bigint;
    if bytes not between 1 and 10485760 then raise exception 'FILE_SIZE'; end if;
    total := total + bytes;
    files := files || jsonb_build_array(jsonb_build_object('name',filename,'group',group_name,'size',bytes,'extension',ext));
  end loop;
  if total > 10485760
    or (select count(*) from jsonb_array_elements(files) f where f->>'group' = 'application') <> 1
    or not exists (select 1 from jsonb_array_elements(files) f where f->>'group' = 'degree')
    or not exists (select 1 from jsonb_array_elements(files) f where f->>'group' = 'transcript') then
    raise exception 'FILES_REQUIRED_OR_TOO_LARGE';
  end if;
  payload := encode(sha256(convert_to(jsonb_build_object('fields',fields,'files',files,
    'language',p_language,'consent_version',p_consent_version)::text,'UTF8')),'hex');
  -- Serialize one idempotency key before testing existence. Hash collisions only
  -- cause extra waiting; the unique full hash remains the source of identity.
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key_hash, 20261030));
  select * into a from public.recruit_applications where idempotency_key_hash = p_idempotency_key_hash for update;
  if found then
    if a.payload_hash <> payload then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    if a.stage = 'purging' or (a.stage = 'staging' and a.staging_expires_at <= clock_timestamp())
      or (a.stage = 'submitted' and a.expires_at <= clock_timestamp()) then raise exception 'APPLICATION_EXPIRED'; end if;
  else
    insert into public.recruit_applications(id,idempotency_key_hash,payload_hash,name,email,phone,
      area,education,experience,message,language,consent,consent_version)
    values(p_id,p_idempotency_key_hash,payload,v_name,v_email,v_phone,v_area,v_education,
      v_experience,v_message,p_language,true,p_consent_version) returning * into a;
    for item in select value from jsonb_array_elements(files) loop
      file_id := gen_random_uuid(); ext := item->>'extension';
      insert into public.recruit_application_files(id,application_id,slot,file_group,original_name,
        extension,content_type,size_bytes,object_path)
      values(file_id,a.id,slot_no,item->>'group',item->>'name',ext,
        case ext when 'pdf' then 'application/pdf' when 'doc' then 'application/msword'
          when 'docx' then 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          when 'zip' then 'application/zip' end,
        (item->>'size')::bigint,'v1/'||a.id::text||'/'||file_id::text||'.'||ext);
      slot_no := slot_no + 1;
    end loop;
  end if;
  return jsonb_build_object('id',a.id,'stage',a.stage,'created_at',a.created_at,
    'staging_expires_at',a.staging_expires_at,'files',
    (select jsonb_agg(to_jsonb(f) order by f.slot) from public.recruit_application_files f where f.application_id = a.id));
end $$;

-- Server must read/verify actual bytes (including hash and signature) BEFORE RPC.
-- SQL can verify Storage metadata, not file bytes or malware safety.
create function public.recruit_verify_file(p_application_id uuid, p_file_id uuid, p_sha256 text)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.recruit_applications%rowtype; f public.recruit_application_files%rowtype;
  o storage.objects%rowtype;
begin
  select * into a from public.recruit_applications where id = p_application_id for update;
  if not found then raise exception 'APPLICATION_NOT_FOUND'; end if;
  select * into f from public.recruit_application_files where id = p_file_id and application_id = a.id for update;
  if not found or p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_FILE'; end if;
  if a.stage <> 'staging' or a.staging_expires_at <= clock_timestamp() then raise exception 'APPLICATION_NOT_STAGING'; end if;
  select * into o from storage.objects where bucket_id = f.bucket_id and name = f.object_path;
  if not found or not exists (select 1 from storage.buckets where id = f.bucket_id and public = false)
    or (case when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::numeric end) is distinct from f.size_bytes
    or o.updated_at is null then raise exception 'STORAGE_FILE_MISMATCH'; end if;
  if f.storage_status = 'ready' then
    if f.sha256 <> p_sha256 or f.storage_object_id <> o.id or f.storage_updated_at <> o.updated_at then
      raise exception 'VERIFIED_FILE_CHANGED';
    end if;
    return;
  end if;
  update public.recruit_application_files set storage_status = 'ready', sha256 = p_sha256,
    storage_object_id = o.id, storage_updated_at = o.updated_at, verified_at = now() where id = f.id;
end $$;

create function public.recruit_finalize_application(p_application_id uuid, p_recipient text, p_provider text default null)
returns jsonb language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare a public.recruit_applications%rowtype; v_now timestamptz := clock_timestamp();
begin
  select * into a from public.recruit_applications where id = p_application_id for update;
  if not found then raise exception 'APPLICATION_NOT_FOUND'; end if;
  if a.stage = 'submitted' and a.expires_at > v_now then
    return jsonb_build_object('stage','submitted'); -- never overwrite recipient/provider on retries
  end if;
  if a.stage <> 'staging' or a.staging_expires_at <= v_now then raise exception 'APPLICATION_EXPIRED'; end if;
  if not recruit_private.valid_email(p_recipient) or (p_provider is not null and p_provider not in ('smtp','resend')) then
    raise exception 'INVALID_NOTIFICATION_CONFIG';
  end if;
  if not exists (select 1 from storage.buckets where id = 'recruit-files' and public = false)
    or (select count(*) from public.recruit_application_files where application_id = a.id) not between 3 and 10
    or (select sum(size_bytes) from public.recruit_application_files where application_id = a.id) > 10485760
    or (select count(*) from public.recruit_application_files where application_id = a.id and file_group = 'application') <> 1
    or not exists (select 1 from public.recruit_application_files where application_id = a.id and file_group = 'degree')
    or not exists (select 1 from public.recruit_application_files where application_id = a.id and file_group = 'transcript')
    or exists (select 1 from public.recruit_application_files f left join storage.objects o
      on o.bucket_id = f.bucket_id and o.name = f.object_path
      where f.application_id = a.id and (f.storage_status <> 'ready' or o.id is distinct from f.storage_object_id
        or o.updated_at is distinct from f.storage_updated_at
        or (case when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::numeric end) is distinct from f.size_bytes)) then
    raise exception 'FILES_NOT_READY';
  end if;
  update public.recruit_applications set stage = 'submitted', submitted_at = v_now,
    expires_at = v_now + interval '1 year' where id = a.id;
  insert into public.recruit_notifications(application_id, recipient, provider) values(a.id,p_recipient,p_provider);
  return jsonb_build_object('stage','submitted');
end $$;

create function public.recruit_submission_status(p_application_id uuid) returns jsonb
language sql security definer set search_path = '' as $$
  select jsonb_build_object('stage',stage) from public.recruit_applications
    where id = p_application_id and stage <> 'purging'
      and ((stage = 'staging' and staging_expires_at > clock_timestamp())
        or (stage = 'submitted' and expires_at > clock_timestamp()));
$$;

-- A pending job can be claimed once. No automatic requeue of failed/uncertain jobs.
create function public.recruit_claim_notification(p_application_id uuid, p_provider text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n public.recruit_notifications%rowtype;
begin
  perform recruit_private.require_visible(p_application_id);
  select * into n from public.recruit_notifications where application_id = p_application_id for update;
  if not found then return null; end if;
  if n.status = 'sending' and n.started_at < clock_timestamp() - interval '10 minutes' then
    update public.recruit_notifications set status = 'uncertain', last_error_code = 'WORKER_TIMEOUT', finished_at = now()
      where application_id = p_application_id;
    return null;
  end if;
  if n.status <> 'pending' then return null; end if;
  if p_provider is null or p_provider not in ('smtp','resend')
    or (n.provider is not null and n.provider <> p_provider) then raise exception 'PROVIDER_MISMATCH'; end if;
  update public.recruit_notifications set status = 'sending', provider = p_provider,
    attempt_count = attempt_count + 1, claim_token = gen_random_uuid(), started_at = now()
    where application_id = p_application_id returning * into n;
  return to_jsonb(n);
end $$;

create function public.recruit_finish_notification(p_application_id uuid, p_claim_token uuid,
  p_outcome text, p_message_id text default null, p_error_code text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare n public.recruit_notifications%rowtype;
begin
  select * into n from public.recruit_notifications where application_id = p_application_id for update;
  if not found or p_claim_token is null or n.claim_token is distinct from p_claim_token then raise exception 'INVALID_CLAIM'; end if;
  if p_outcome is null or p_outcome not in ('accepted','failed','uncertain') then raise exception 'INVALID_OUTCOME'; end if;
  if p_outcome = 'accepted' and (p_message_id is null or length(btrim(p_message_id)) not between 1 and 1000) then
    raise exception 'RECEIPT_REQUIRED';
  end if;
  if p_outcome <> 'accepted' and (p_error_code is null or p_error_code not in
    ('CONFIGURATION','FILE_UNAVAILABLE','DEFINITELY_REJECTED','NETWORK_UNCERTAIN','WORKER_TIMEOUT')) then
    raise exception 'SAFE_ERROR_CODE_REQUIRED';
  end if;
  if p_outcome = 'failed' and p_error_code not in ('CONFIGURATION','FILE_UNAVAILABLE','DEFINITELY_REJECTED') then
    raise exception 'USE_UNCERTAIN';
  end if;
  if n.status = p_outcome and (p_outcome <> 'accepted' or n.provider_message_id = p_message_id) then return; end if;
  -- A late, definitive receipt can resolve the SAME timed-out attempt, never send again.
  if n.status <> 'sending' and not (n.status = 'uncertain' and p_outcome = 'accepted') then raise exception 'OUTCOME_CONFLICT'; end if;
  update public.recruit_notifications set status = p_outcome, finished_at = now(),
    provider_message_id = case when p_outcome = 'accepted' then p_message_id end,
    last_error_code = case when p_outcome <> 'accepted' then p_error_code end
    where application_id = p_application_id;
end $$;

create function public.recruit_is_admin(p_actor uuid) returns boolean
language sql security definer set search_path = '' as $$
  select exists(select 1 from public.recruit_admins where user_id = p_actor and active);
$$;

create function public.recruit_admin_list(p_actor uuid, p_status text default null,
  p_limit integer default 30, p_before_time timestamptz default null, p_before_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform recruit_private.require_admin(p_actor);
  if p_limit is null or p_limit not between 1 and 100 or (p_status is not null and p_status not in ('unread','reviewed'))
    or ((p_before_time is null) <> (p_before_id is null)) then raise exception 'INVALID_FILTER'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.submitted_at desc,x.id desc),'[]') from
    (select id,name,area,experience,review_status,submitted_at,version from public.recruit_applications
      where stage = 'submitted' and expires_at > clock_timestamp()
        and (p_status is null or review_status = p_status)
        and (p_before_time is null or (submitted_at,id) < (p_before_time,p_before_id))
      order by submitted_at desc,id desc limit p_limit) x);
end $$;

create function public.recruit_admin_detail(p_actor uuid, p_application_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform recruit_private.require_admin(p_actor);
  perform recruit_private.require_visible(p_application_id);
  insert into public.recruit_audit_logs(application_id,actor_user_id,action) values(p_application_id,p_actor,'view_detail');
  return (select jsonb_build_object('application',to_jsonb(a) - array['idempotency_key_hash','payload_hash','staging_expires_at'],
    'files',(select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'group',f.file_group,
      'name',f.original_name,'size',f.size_bytes,'content_type',f.content_type) order by f.slot),'[]')
      from public.recruit_application_files f where f.application_id = a.id))
    from public.recruit_applications a where a.id = p_application_id);
end $$;

create function public.recruit_set_review_status(p_actor uuid, p_application_id uuid, p_status text, p_expected_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.recruit_applications%rowtype;
begin
  perform recruit_private.require_admin(p_actor);
  select * into a from public.recruit_applications where id = p_application_id for update;
  if not found or a.stage <> 'submitted' or a.expires_at <= clock_timestamp() then raise exception 'APPLICATION_NOT_AVAILABLE'; end if;
  if p_status is null or p_status not in ('unread','reviewed') then raise exception 'INVALID_STATUS'; end if;
  if p_expected_version is null or a.version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if a.review_status = p_status then return jsonb_build_object('status',a.review_status,'version',a.version); end if;
  update public.recruit_applications set review_status = p_status, version = version + 1,
    reviewed_by = case when p_status = 'reviewed' then p_actor end,
    reviewed_at = case when p_status = 'reviewed' then now() end
    where id = a.id returning * into a;
  insert into public.recruit_audit_logs(application_id,actor_user_id,action)
    values(a.id,p_actor,case when p_status = 'reviewed' then 'mark_reviewed' else 'mark_unread' end);
  return jsonb_build_object('status',a.review_status,'version',a.version);
end $$;

create function public.recruit_prepare_download(p_actor uuid, p_file_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare f public.recruit_application_files%rowtype; ttl integer;
begin
  perform recruit_private.require_admin(p_actor);
  select * into f from public.recruit_application_files where id = p_file_id;
  if not found or f.storage_status <> 'ready' then raise exception 'FILE_NOT_AVAILABLE'; end if;
  perform recruit_private.require_visible(f.application_id);
  if not exists (select 1 from storage.buckets where id = f.bucket_id and public = false) then
    raise exception 'PRIVATE_BUCKET_REQUIRED';
  end if;
  select least(60,floor(extract(epoch from (expires_at - clock_timestamp())))::integer) into ttl
    from public.recruit_applications where id = f.application_id;
  if ttl < 1 then raise exception 'APPLICATION_EXPIRED'; end if;
  return jsonb_build_object('bucket',f.bucket_id,'path',f.object_path,'filename',f.original_name,'expires_in',ttl);
end $$;

-- Call only AFTER successful Storage signed URL creation, BEFORE returning URL.
-- This log records URL issuance, not actual download completion. No URL is stored.
create function public.recruit_record_download(p_actor uuid, p_file_id uuid, p_ttl_seconds integer)
returns void language plpgsql security definer set search_path = '' as $$
declare f public.recruit_application_files%rowtype;
begin
  perform recruit_private.require_admin(p_actor);
  select * into f from public.recruit_application_files where id = p_file_id;
  if not found or f.storage_status <> 'ready' or p_ttl_seconds is null or p_ttl_seconds not between 1 and 60 then
    raise exception 'INVALID_DOWNLOAD';
  end if;
  perform recruit_private.require_visible(f.application_id);
  insert into public.recruit_audit_logs(application_id,actor_user_id,action,file_id,signed_url_ttl_seconds)
    values(f.application_id,p_actor,'download_url_issued',f.id,p_ttl_seconds);
end $$;

-- Apply ACLs inside the same transaction: no PUBLIC execute window.
revoke all on all functions in schema recruit_private from public, anon, authenticated, service_role;
do $$
declare fn regprocedure;
begin
  for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'recruit\_%' escape '\'
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role',fn);
    execute format('grant execute on function %s to service_role',fn);
  end loop;
end $$;
-- Fail closed if custom inherited/default grants defeat the intended boundary.
do $$
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join (values ('anon'),('authenticated'),('service_role')) r(role_name)
    where c.relkind = 'r' and (n.nspname = 'recruit_private'
      or (n.nspname = 'public' and c.relname like 'recruit\_%' escape '\'))
      and (has_table_privilege(r.role_name,c.oid,'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
        or has_any_column_privilege(r.role_name,c.oid,'SELECT, INSERT, UPDATE, REFERENCES'))
  ) then raise exception 'UNEXPECTED_INHERITED_TABLE_GRANT: inspect role/default privileges'; end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    cross join (values ('anon'),('authenticated')) r(role_name)
    where (n.nspname = 'recruit_private'
      or (n.nspname = 'public' and p.proname like 'recruit\_%' escape '\'))
      and has_function_privilege(r.role_name,p.oid,'EXECUTE')
  ) then raise exception 'UNEXPECTED_INHERITED_FUNCTION_GRANT: inspect role/default privileges'; end if;
end $$;
insert into recruit_private.migrations(version) values('202610300001_recruit');
notify pgrst, 'reload schema';
commit;
