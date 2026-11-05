-- Apply as postgres after 202610300001_recruit. Includes the 2 currently displayed papers.
-- Existing news, recruitment data and file storage are not modified.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(20261030,1);
do $$ begin
  if current_user<>'postgres' then raise exception 'Run as postgres'; end if;
  if not exists(select 1 from recruit_private.migrations where version='202610300001_recruit') then raise exception 'Base migration required'; end if;
  if exists(select 1 from recruit_private.migrations where version='202611050002_publications_cms') then raise exception 'Already applied'; end if;
end $$;
create function recruit_private.valid_publication(value jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare field record; language text; begin
  if value is null or jsonb_typeof(value)<>'object' or octet_length(value::text)>40000 then return false; end if;
  if exists(select 1 from jsonb_object_keys(value) k where k not in
    ('year','title','authors','mycodxAuthors','journal','volume','article','description','doi','url')) then return false; end if;
  if jsonb_typeof(value->'year') is distinct from 'number' or coalesce(value->>'year','') !~ '^[0-9]{4}$'
    or (value->>'year')::integer not between 1900 and 2200 then return false; end if;
  for field in select * from (values ('title',500,true),('authors',2000,true),('mycodxAuthors',1000,false),
    ('journal',300,true),('volume',100,false),('article',100,false),('doi',250,false),('url',1000,true)) f(name,max_length,required)
  loop
    if jsonb_typeof(value->field.name) is distinct from 'string' or length(value->>field.name)>field.max_length
      or (field.required and btrim(value->>field.name)='') then return false; end if;
  end loop;
  if jsonb_typeof(value->'description') is distinct from 'object' then return false; end if;
  if exists(select 1 from jsonb_object_keys(value->'description') k where k not in ('ko','en','fr','ja')) then return false; end if;
  foreach language in array array['ko','en','fr','ja'] loop
    if language in ('ko','en') or (value->'description') ? language then
      if jsonb_typeof(value->'description'->language) is distinct from 'string'
        or length(value->'description'->>language)>2000 then return false; end if;
    end if;
  end loop;
  if value->>'doi'<>'' and value->>'doi' !~ '^10\.[0-9]{4,9}/[^[:space:]]+$' then return false; end if;
  return (value->>'url' ~ '^https://[^[:space:]@/]+(/[^[:space:]]*)?$'
    or value->>'url' ~* '^/papers/[a-z0-9_-]+\.pdf$');
end $$;
revoke all on function recruit_private.valid_publication(jsonb) from public,anon,authenticated,service_role;
create table public.publications_posts (
  id uuid primary key,
  draft jsonb not null check(recruit_private.valid_publication(draft)),
  published jsonb check(published is null or recruit_private.valid_publication(published)),
  version integer not null default 1 check(version>0),
  published_version integer,
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  check ((published is null and published_version is null and published_at is null)
    or (published is not null and published_version>0 and published_version<=version and published_at is not null))
);
create unique index publications_draft_doi on public.publications_posts(lower(draft->>'doi')) where draft->>'doi'<>'';
create unique index publications_published_doi on public.publications_posts(lower(published->>'doi')) where published->>'doi'<>'';
create table public.publications_audit_logs (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.publications_posts(id), actor_user_id uuid not null,
  action text not null check(action in ('save','publish','unpublish')), version integer not null,
  created_at timestamptz not null default now()
);
alter table public.publications_posts enable row level security;
alter table public.publications_audit_logs enable row level security;
revoke all on public.publications_posts,public.publications_audit_logs from public,anon,authenticated,service_role;
revoke all on sequence public.publications_audit_logs_id_seq from public,anon,authenticated,service_role;
create index publications_admin_order on public.publications_posts(updated_at desc,id desc);
create index publications_public_order on public.publications_posts(((published->>'year')::integer) desc,id desc) where published is not null;

create function public.publications_admin_list(p_actor uuid,p_before_time timestamptz default null,p_before_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$ begin
  perform recruit_private.require_admin(p_actor);
  if (p_before_time is null)<>(p_before_id is null) then raise exception 'INVALID_FILTER'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(x) order by updated_at desc,id desc),'[]') from
    (select id,draft->>'title' as title,(draft->>'year')::integer as year,version,published_version,updated_at,published_at
     from public.publications_posts where p_before_time is null or (updated_at,id)<(p_before_time,p_before_id)
     order by updated_at desc,id desc limit 21) x);
end $$;
create function public.publications_admin_detail(p_actor uuid,p_post_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$ declare result jsonb; begin
  perform recruit_private.require_admin(p_actor);
  select to_jsonb(n)-'published' into result from public.publications_posts n where id=p_post_id;
  if result is null then raise exception 'PUBLICATION_NOT_FOUND'; end if;
  return result;
end $$;
create function public.publications_save(p_actor uuid,p_post_id uuid,p_version integer,p_draft jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$ declare n public.publications_posts%rowtype; begin
  perform recruit_private.require_admin(p_actor);
  if p_post_id is null or p_version is null or p_version<0 or p_version>2147483646
    or not recruit_private.valid_publication(p_draft) then raise exception 'INVALID_FIELDS'; end if;
  -- A fixed internal UUID makes retrying a new draft safe.
  perform pg_advisory_xact_lock(hashtextextended(p_post_id::text,20261104));
  select * into n from public.publications_posts where id=p_post_id for update;
  if found then
    if n.version<>p_version then raise exception 'VERSION_CONFLICT'; end if;
    update public.publications_posts set draft=p_draft,version=version+1,updated_at=clock_timestamp() where id=p_post_id returning * into n;
  else
    if p_version<>0 then raise exception 'VERSION_CONFLICT'; end if;
    begin
      insert into public.publications_posts(id,draft) values(p_post_id,p_draft) returning * into n;
    exception when unique_violation then raise exception 'PUBLICATION_DOI_EXISTS'; end;
  end if;
  insert into public.publications_audit_logs(post_id,actor_user_id,action,version) values(n.id,p_actor,'save',n.version);
  return to_jsonb(n)-'published';
exception when unique_violation then raise exception 'PUBLICATION_DOI_EXISTS';
end $$;
create function public.publications_publish(p_actor uuid,p_post_id uuid,p_version integer,p_publish boolean)
returns jsonb language plpgsql security definer set search_path='' as $$ declare n public.publications_posts%rowtype; begin
  perform recruit_private.require_admin(p_actor);
  select * into n from public.publications_posts where id=p_post_id for update;
  if not found then raise exception 'PUBLICATION_NOT_FOUND'; end if;
  if p_version is null or p_version>2147483646 or n.version<>p_version then raise exception 'VERSION_CONFLICT'; end if;
  if p_publish is null then raise exception 'INVALID_FIELDS'; end if;
  update public.publications_posts set version=version+1,
    published=case when p_publish then draft else null end,
    published_version=case when p_publish then version+1 else null end,
    published_at=case when p_publish then clock_timestamp() else null end,updated_at=clock_timestamp()
    where id=p_post_id returning * into n;
  insert into public.publications_audit_logs(post_id,actor_user_id,action,version)
    values(n.id,p_actor,case when p_publish then 'publish' else 'unpublish' end,n.version);
  return to_jsonb(n)-'published';
exception when unique_violation then raise exception 'PUBLICATION_DOI_EXISTS';
end $$;
create function public.publications_public_list(p_before_year integer default null,p_before_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$ begin
  if (p_before_year is null)<>(p_before_id is null) then raise exception 'INVALID_FILTER'; end if;
  return (select coalesce(jsonb_agg(content order by year desc,id desc),'[]') from (
    select published || jsonb_build_object('id',id) as content,(published->>'year')::integer as year,id
    from public.publications_posts where published is not null
      and (p_before_year is null or ((published->>'year')::integer,id)<(p_before_year,p_before_id))
    order by (published->>'year')::integer desc,id desc limit 21
  ) x);
end $$;
do $$ declare fn regprocedure; begin
  for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('publications_admin_list','publications_admin_detail','publications_save','publications_publish','publications_public_list')
  loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',fn);
    execute format('grant execute on function %s to service_role',fn);
    if has_function_privilege('anon',fn,'EXECUTE') or has_function_privilege('authenticated',fn,'EXECUTE') then raise exception 'Unexpected inherited grants'; end if;
  end loop;
  if exists(select 1 from (values ('anon'),('authenticated'),('service_role')) r(role_name)
    cross join (values ('public.publications_posts'::regclass),('public.publications_audit_logs'::regclass)) t(table_id)
    where has_table_privilege(r.role_name,t.table_id,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      or has_any_column_privilege(r.role_name,t.table_id,'SELECT,INSERT,UPDATE,REFERENCES')) then raise exception 'Unexpected inherited table grants'; end if;
end $$;
-- Import only the two papers currently visible on /publications. No invented admin audit actor.
insert into public.publications_posts(id,draft,published,published_version,published_at)
values('bb7b3315-dc91-497c-a4a5-000000000002', $paper${
  "year": 2026,
  "title": "Evaluation of the GCdiaMTB/NTM real-time PCR kit according to the Korean in vitro diagnostic medical device approval standards",
  "authors": "Seo Yong Choe, Da-Gyum Lee, Jin-A Park, et al.",
  "mycodxAuthors": "Jin-A Park · JeongA Kim · Sungweon Ryoo",
  "journal": "Journal of Microbiological Methods",
  "volume": "250",
  "article": "107717",
  "description": {
    "ko": "GCdiaMTB/NTM Real-Time PCR Kit의 결핵균군 및 비결핵항산균 진단 성능을 국내 체외진단의료기기 허가 기준에 따라 평가한 연구입니다.",
    "en": "A clinical performance evaluation of the GCdiaMTB/NTM Real-Time PCR Kit for detecting MTBC and NTM under Korean in vitro diagnostic medical device approval standards.",
    "fr": "Une évaluation des performances cliniques du kit PCR en temps réel GCdiaMTB/NTM pour la détection du MTBC et des MNT selon les normes coréennes d'autorisation des dispositifs médicaux de diagnostic in vitro.",
    "ja": "韓国の体外診断用医療機器の承認基準に基づき、GCdiaMTB/NTMリアルタイムPCRキットの結核菌群および非結核性抗酸菌の検出性能を評価した研究です。"
  },
  "doi": "10.1016/j.mimet.2026.107717",
  "url": "/papers/evaluation-gcdia-mtb-ntm-real-time-pcr-kit.pdf"
}$paper$::jsonb, $paper${
  "year": 2026,
  "title": "Evaluation of the GCdiaMTB/NTM real-time PCR kit according to the Korean in vitro diagnostic medical device approval standards",
  "authors": "Seo Yong Choe, Da-Gyum Lee, Jin-A Park, et al.",
  "mycodxAuthors": "Jin-A Park · JeongA Kim · Sungweon Ryoo",
  "journal": "Journal of Microbiological Methods",
  "volume": "250",
  "article": "107717",
  "description": {
    "ko": "GCdiaMTB/NTM Real-Time PCR Kit의 결핵균군 및 비결핵항산균 진단 성능을 국내 체외진단의료기기 허가 기준에 따라 평가한 연구입니다.",
    "en": "A clinical performance evaluation of the GCdiaMTB/NTM Real-Time PCR Kit for detecting MTBC and NTM under Korean in vitro diagnostic medical device approval standards.",
    "fr": "Une évaluation des performances cliniques du kit PCR en temps réel GCdiaMTB/NTM pour la détection du MTBC et des MNT selon les normes coréennes d'autorisation des dispositifs médicaux de diagnostic in vitro.",
    "ja": "韓国の体外診断用医療機器の承認基準に基づき、GCdiaMTB/NTMリアルタイムPCRキットの結核菌群および非結核性抗酸菌の検出性能を評価した研究です。"
  },
  "doi": "10.1016/j.mimet.2026.107717",
  "url": "/papers/evaluation-gcdia-mtb-ntm-real-time-pcr-kit.pdf"
}$paper$::jsonb,1,now());
insert into public.publications_posts(id,draft,published,published_version,published_at)
values('bb7b3315-dc91-497c-a4a5-000000000001', $paper${
  "year": 2026,
  "title": "Metformin Modulates Ferroptosis-Related and Antioxidant Gene Expression in Brown Adipose Tissue",
  "authors": "Dong Soo Seo, Sungjun Park, Yusra Ahmad, et al.",
  "mycodxAuthors": "Jin-A Park · Sungweon Ryoo",
  "journal": "International Journal of Molecular Sciences",
  "volume": "27",
  "article": "7625",
  "description": {
    "ko": "갈색 지방 조직에서 metformin이 유도하는 항산화 및 ferroptosis 관련 경로 변화에 대한 연구입니다.",
    "en": "Research on metformin-induced changes in antioxidant and ferroptosis-related pathways in brown adipose tissue.",
    "fr": "Recherche sur les changements induits par la metformine dans les voies antioxydantes et liées à la ferroptose du tissu adipeux brun.",
    "ja": "褐色脂肪組織におけるmetformin誘導性の抗酸化およびferroptosis関連経路の変化に関する研究です。"
  },
  "doi": "10.3390/ijms27177625",
  "url": "/papers/metformin-ferroptosis-brown-adipose-tissue.pdf"
}$paper$::jsonb, $paper${
  "year": 2026,
  "title": "Metformin Modulates Ferroptosis-Related and Antioxidant Gene Expression in Brown Adipose Tissue",
  "authors": "Dong Soo Seo, Sungjun Park, Yusra Ahmad, et al.",
  "mycodxAuthors": "Jin-A Park · Sungweon Ryoo",
  "journal": "International Journal of Molecular Sciences",
  "volume": "27",
  "article": "7625",
  "description": {
    "ko": "갈색 지방 조직에서 metformin이 유도하는 항산화 및 ferroptosis 관련 경로 변화에 대한 연구입니다.",
    "en": "Research on metformin-induced changes in antioxidant and ferroptosis-related pathways in brown adipose tissue.",
    "fr": "Recherche sur les changements induits par la metformine dans les voies antioxydantes et liées à la ferroptose du tissu adipeux brun.",
    "ja": "褐色脂肪組織におけるmetformin誘導性の抗酸化およびferroptosis関連経路の変化に関する研究です。"
  },
  "doi": "10.3390/ijms27177625",
  "url": "/papers/metformin-ferroptosis-brown-adipose-tissue.pdf"
}$paper$::jsonb,1,now());
insert into recruit_private.migrations(version) values('202611050002_publications_cms');
notify pgrst,'reload schema';
commit;
