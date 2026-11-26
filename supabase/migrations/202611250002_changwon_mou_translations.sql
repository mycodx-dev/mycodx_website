-- 협약 소식의 빈 영어·프랑스어·일본어 제목·요약·본문만 보완합니다.
-- 기존 202611250001_changwon_mou_news.sql 적용 후, SQL Editor에서 postgres로 실행합니다.
-- 게시 중인 글은 번역이 즉시 반영됩니다. 비공개 글은 다시 공개하지 않습니다.
-- 한국어, 기존 번역, 글 번호, 날짜, 정렬, 사진, 미게시 수정 사항은 보존합니다.
-- 재실행은 이후 편집 내용을 덮어쓰지 않습니다.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
select pg_advisory_xact_lock(20261030, 1);

do $migration$
declare
  news_id constant uuid := 'b8d6ae47-e5e3-4e56-bc41-96e79624ba25';
  post public.news_posts%rowtype;
  reference_ko constant jsonb := $reference${
  "title": "마이코디엑스, 국립창원대학교 경남생명항노화 핵심연구지원센터와 업무협약 체결",
  "summary": "공동연구 및 기술교류 활성화를 위한 상호협력 기반 마련",
  "body": "㈜마이코디엑스와 국립창원대학교 경남생명항노화 핵심연구지원센터는 2026년 11월 25일, 상호 존중과 신뢰를 바탕으로 연구역량 강화와 공동 발전을 위한 상호협력 양해각서(MOU)를 체결했습니다.\n\n이번 협약을 통해 양 기관은 보유한 연구역량, 기술 및 인프라를 적극 활용하여 공동연구와 기술교류를 활성화하고, 상호 협력을 통한 연구성과 창출과 공동 발전을 도모할 예정입니다."
}$reference$::jsonb;
  translations constant jsonb := $translations${
  "title": {
    "en": "MycoDx Signs Research Cooperation MOU with Changwon National University's Gyeongnam Life Science and Anti-Aging Core Research Support Center",
    "fr": "MycoDx signe un accord de coopération avec le Centre de soutien à la recherche en sciences de la vie et anti-âge de Gyeongnam de l’Université nationale de Changwon",
    "ja": "MycoDx、国立昌原大学校の慶南生命抗老化核心研究支援センターと研究協力に関する覚書を締結"
  },
  "summary": {
    "en": "Establishing a framework for cooperation to promote joint research and technology exchange.",
    "fr": "Mise en place d’un cadre de coopération pour promouvoir la recherche conjointe et les échanges technologiques.",
    "ja": "共同研究と技術交流の活性化に向けた相互協力の基盤を構築"
  },
  "body": {
    "en": "On November 25, 2026, MycoDx Co., Ltd. and the Gyeongnam Life Science and Anti-Aging Core Research Support Center at Changwon National University signed a memorandum of understanding (MOU) for mutual cooperation. Based on mutual respect and trust, the agreement aims to strengthen research capabilities and promote shared development.\n\nThrough this agreement, the two organizations plan to make active use of their research capabilities, technologies, and infrastructure to promote joint research and technology exchange, generate research outcomes, and advance together through collaboration.",
    "fr": "Le 25 novembre 2026, MycoDx Co., Ltd. et le Centre de soutien à la recherche en sciences de la vie et anti-âge de Gyeongnam de l’Université nationale de Changwon ont signé un protocole d’accord de coopération. Fondé sur le respect et la confiance mutuels, cet accord vise à renforcer leurs capacités de recherche et à favoriser leur développement commun.\n\nDans le cadre de cet accord, les deux organismes prévoient de mobiliser leurs capacités de recherche, leurs technologies et leurs infrastructures afin de promouvoir la recherche conjointe et les échanges technologiques, de produire des résultats de recherche et de soutenir leur développement commun.",
    "ja": "株式会社MycoDxと国立昌原大学校の慶南生命抗老化核心研究支援センターは、2026年11月25日、相互の尊重と信頼に基づき、研究能力の強化と双方の発展を目指す相互協力に関する覚書（MOU）を締結しました。\n\n今回の協約を通じて、両機関はそれぞれが有する研究能力、技術およびインフラを積極的に活用し、共同研究と技術交流を活性化するとともに、相互協力による研究成果の創出と双方の発展を図る予定です。"
  }
}$translations$::jsonb;
  snapshot_name text;
  field_name text;
  language_code text;
  snapshot jsonb;
  new_draft jsonb;
  new_published jsonb;
begin
  if current_user <> 'postgres' then raise exception 'Run as postgres'; end if;
  if not exists (select 1 from recruit_private.migrations where version = '202611250001_changwon_mou_news') then
    raise exception 'Apply 202611250001_changwon_mou_news.sql first';
  end if;
  if exists (select 1 from recruit_private.migrations where version = '202611250002_changwon_mou_translations') then
    raise notice 'Already applied. Existing content and publication status are unchanged.';
    return;
  end if;

  select * into post from public.news_posts where id = news_id for update;
  if not found then raise exception 'The Changwon MOU post was not found; no content changed'; end if;
  new_draft := post.draft;
  new_published := post.published;

  foreach snapshot_name in array array['draft', 'published'] loop
    snapshot := case when snapshot_name = 'draft' then post.draft else post.published end;
    if snapshot is null then continue; end if;
    foreach field_name in array array['title', 'summary', 'body'] loop
      foreach language_code in array array['en', 'fr', 'ja'] loop
        if coalesce(btrim(snapshot #>> array[field_name, language_code]), '') = '' then
          -- Changed Korean copy needs a matching translation; never silently translate an older revision.
          if (snapshot #>> array[field_name, 'ko']) is distinct from (reference_ko ->> field_name) then
            raise exception 'Korean % in % has changed. Review translations before applying; no content changed.', field_name, snapshot_name;
          end if;
          snapshot := jsonb_set(snapshot, array[field_name, language_code], translations #> array[field_name, language_code], true);
        end if;
      end loop;
    end loop;
    if snapshot_name = 'draft' then new_draft := snapshot; else new_published := snapshot; end if;
  end loop;

  if new_draft is distinct from post.draft or new_published is distinct from post.published then
    update public.news_posts
    set draft = new_draft,
        published = new_published,
        version = post.version + 1,
        published_version = case
          when new_published is null then null
          when post.published_version = post.version and new_draft = new_published then post.version + 1
          else post.published_version
        end,
        updated_at = clock_timestamp()
    where id = news_id;
  end if;
  insert into recruit_private.migrations (version) values ('202611250002_changwon_mou_translations');
end
$migration$;
commit;

-- 게시 중인 글은 draft/published 두 행에서 en_ready, fr_ready, ja_ready가 모두 true여야 합니다.
-- 비공개 글은 draft만 반환하며, 공개 상태를 변경하지 않습니다.
select '/news/' || n.post_number as public_path,
  s.snapshot_name,
  n.published is not null as is_published,
  not exists (select 1 from unnest(array['title', 'summary', 'body']) as f(field_name)
    where coalesce(btrim(s.content #>> array[f.field_name, 'en']), '') = '') as en_ready,
  not exists (select 1 from unnest(array['title', 'summary', 'body']) as f(field_name)
    where coalesce(btrim(s.content #>> array[f.field_name, 'fr']), '') = '') as fr_ready,
  not exists (select 1 from unnest(array['title', 'summary', 'body']) as f(field_name)
    where coalesce(btrim(s.content #>> array[f.field_name, 'ja']), '') = '') as ja_ready
from public.news_posts n
cross join lateral (values ('draft', n.draft), ('published', n.published)) as s(snapshot_name, content)
where n.id = 'b8d6ae47-e5e3-4e56-bc41-96e79624ba25'::uuid and s.content is not null;
