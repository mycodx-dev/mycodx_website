-- ICID 2026 기존 소식(/news/4)을 행사 종료 후 내용으로 수정합니다.
-- 먼저 public/uploads/news/icid-2026-poster.jpg가 포함된 코드를 배포한 뒤,
-- 사진 URL이 정상 응답하는지 확인하고 Supabase SQL Editor에서 postgres로 실행합니다.
-- 실행 즉시 한국어/영어 제목·요약·본문·대표 사진을 함께 갱신합니다.
-- 글 번호, 기존 게시 날짜, 분류, 링크 및 다른 소식은 유지합니다.
-- 별도 수정 초안이나 기존 본문 변경이 있으면 중단합니다. 재실행은 변경하지 않습니다.
-- 관리자 계정을 대신하지 않으며 적용 이력은 recruit_private.migrations에 남깁니다.
-- 연구 수치와 검증 범위의 출처: 사용자가 제공한 ICID 2026 포스터 #3662.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
select pg_advisory_xact_lock(20261030, 1);

do $migration$
declare
  post public.news_posts%rowtype;
  content jsonb;
  field text;
  expected jsonb := $expected${
    "title": {
      "ko": "마드리드 ICID 2026에서 연구 포스터 발표",
      "en": "Research Poster Presentation at ICID 2026 in Madrid"
    },
    "summary": {
      "ko": "MycoDx가 국제감염병학회 ICID 2026에 참가해 AI 기반 결핵 약제감수성검사 자동화 플랫폼 관련 연구를 포스터로 소개합니다.",
      "en": "MycoDx is participating in ICID 2026 to present a research poster on its AI-driven platform for automated tuberculosis drug susceptibility testing."
    },
    "body": {
      "ko": "MycoDx는 2026년 11월 10일부터 13일까지 스페인 마드리드에서 열리는 제21회 국제감염병학회(ICID 2026)에 참가합니다.\n\n이번 학회에서는 AI 기반 결핵 약제감수성검사 자동화 플랫폼의 개발 방향과 관련 평가 연구를 포스터로 소개합니다. 검사 과정의 표준화와 자동화를 위한 연구를 공유하고, 감염병 분야의 연구자 및 전문가들과 교류할 예정입니다.",
      "en": "MycoDx is participating in the 21st International Congress on Infectious Diseases (ICID 2026), taking place from November 10 to 13, 2026, in Madrid, Spain.\n\nAt the congress, MycoDx will present a poster outlining the development of its AI-driven platform for automated tuberculosis drug susceptibility testing and related evaluation research. The presentation will highlight efforts to standardize and automate testing workflows and provide an opportunity to exchange perspectives with researchers and professionals in infectious diseases."
    },
    "image": "",
    "imageAlt": { "ko": "", "en": "" }
  }$expected$::jsonb;
  changes jsonb := $content${
    "title": {
      "ko": "마이코디엑스, ICID 2026에서 결핵 약제감수성검사 자동화 플랫폼 연구 발표",
      "en": "MycoDx Presents Research on an Automated Tuberculosis Drug Susceptibility Testing Platform at ICID 2026"
    },
    "summary": {
      "ko": "마이코디엑스가 스페인 마드리드에서 열린 ICID 2026에 참가해 AI 기반 결핵 약제감수성검사 자동화 플랫폼 관련 연구를 포스터로 발표했습니다.",
      "en": "MycoDx presented research on its AI-driven platform for automated tuberculosis drug susceptibility testing at ICID 2026 in Madrid, Spain."
    },
    "body": {
      "ko": "마이코디엑스(MycoDx)는 2026년 11월 10일부터 13일까지 스페인 마드리드에서 열린 제21회 국제감염병학회(ICID 2026)에 참가해 연구 성과를 발표했습니다.\n\n이번 학회에서는 다제내성 및 광범위 약제내성 결핵(MDR/XDR-TB)의 약제감수성검사(DST)를 자동화하기 위한 AI 기반 플랫폼의 개발 및 임상 평가 연구를 포스터로 발표했습니다.\n\n이 플랫폼은 6-well 고체배지 기반 검사에 자동 접종, 배양 및 AI 기반 집락 판독 기술을 통합하는 것을 목표로 합니다. 임상 검체에서 분리한 결핵균 53개 균주를 대상으로 비교 평가한 결과, 6-well 고체배지 기반 검사는 REMA 기준 검사법과 87.8%의 전체 약제감수성 판정 일치율을 보였습니다. AI 기반 집락 판독 성능에 대한 검증은 진행 중입니다.\n\n마이코디엑스는 앞으로도 검사 과정의 자동화와 표준화를 위한 플랫폼 개발 및 검증을 이어갈 계획입니다.",
      "en": "MycoDx presented its research at the 21st International Congress on Infectious Diseases (ICID 2026), held in Madrid, Spain, from November 10 to 13, 2026.\n\nThe company presented a poster on the development and clinical evaluation of an AI-driven platform to automate drug susceptibility testing (DST) for multidrug-resistant and extensively drug-resistant tuberculosis (MDR/XDR-TB).\n\nThe platform is being developed to combine six-well solid-medium testing with automated inoculation, incubation, and AI-based colony reading. In a comparison involving 53 tuberculosis strains isolated from clinical samples, the six-well solid-medium assay showed 87.8% overall agreement in drug susceptibility results with the REMA reference method. Validation of AI-based colony reading performance is ongoing.\n\nMycoDx plans to continue developing and validating the platform to help automate and standardize testing workflows."
    },
    "image": "/uploads/news/icid-2026-poster.jpg",
    "imageAlt": {
      "ko": "스페인 마드리드에서 열린 ICID 2026에 전시된 마이코디엑스의 결핵 약제감수성검사 자동화 플랫폼 연구 포스터.",
      "en": "MycoDx's research poster on an automated tuberculosis drug susceptibility testing platform, displayed at ICID 2026 in Madrid, Spain."
    }
  }$content$::jsonb;
begin
  if current_user <> 'postgres' then raise exception 'Run as postgres'; end if;
  if not exists (select 1 from recruit_private.migrations where version = '202611040004_news_numbers') then
    raise exception 'Apply the news numbering migration first';
  end if;
  if exists (select 1 from recruit_private.migrations where version = '202611200001_icid_2026_recap') then
    raise notice 'Already applied. Existing content and publication status are unchanged.';
    return;
  end if;

  select * into post from public.news_posts where post_number = 4 and slug = '4' for update;
  if not found then raise exception 'The existing ICID 2026 post /news/4 was not found'; end if;
  if post.published is null then raise exception 'ICID post is unpublished; review it in /admin'; end if;
  if post.version is distinct from post.published_version or post.draft is distinct from post.published then
    raise exception 'ICID post has an unpublished draft; review it in /admin';
  end if;
  if not (post.published @> expected) then
    raise exception 'ICID post has changed since review; compare the current content in /admin';
  end if;

  content := post.draft;
  foreach field in array array['title', 'summary', 'body', 'imageAlt'] loop
    content := jsonb_set(content, array[field], coalesce(content->field, '{}'::jsonb) || (changes->field));
  end loop;
  content := jsonb_set(content, '{image}', changes->'image');

  update public.news_posts
  set draft = content, published = content,
      version = version + 1, published_version = version + 1,
      updated_at = clock_timestamp()
  where id = post.id;
  insert into recruit_private.migrations (version) values ('202611200001_icid_2026_recap');
end
$migration$;
commit;

-- 확인: /news/4, 한·영 수정 제목, 포스터 이미지 경로, has_unpublished_changes=false.
select '/news/' || post_number as public_path,
  published->'title'->>'ko' as title_ko,
  published->'title'->>'en' as title_en,
  published->>'image' as image,
  version is distinct from published_version as has_unpublished_changes
from public.news_posts where post_number = 4 and slug = '4';
