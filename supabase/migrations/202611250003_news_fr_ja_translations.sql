-- 기존 소식 4건의 빈 프랑스어·일본어 번역을 채웁니다.
-- 대상: 홈페이지 개설(1), KIMES BUSAN(2), ICID(3), CES(4).
-- Supabase SQL Editor에서 postgres로 실행합니다. 별도 스키마 변경은 없습니다.
-- 한국어·영어, 이미 입력된 번역, 사진, 글 주소, 날짜·정렬, 공개 상태를 보존합니다.
-- 공개본과 초안을 각각 보완하므로 미게시 수정 사항은 공개되지 않습니다.
-- 원문이 달라졌거나 대상 글을 찾지 못하면 전체 작업을 취소합니다.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
select pg_advisory_xact_lock(20261030, 1);

do $migration$
declare
  patches constant jsonb := $patches$[
  {
    "slug": "website-launch",
    "postNumber": 1,
    "referenceKo": {
      "title": "MycoDx 공식 홈페이지를 개설했습니다.",
      "summary": "MycoDx의 연구 방향, 연구진, 연구 성과와 회사 소식을 보다 명확하게 전달하기 위해 공식 홈페이지를 개설했습니다.",
      "body": "MycoDx의 연구와 기술, 그리고 회사의 활동을 소개하는 공식 홈페이지를 개설했습니다. MycoDx를 처음 접하는 분들도 회사가 지향하는 방향과 주요 연구 분야를 살펴볼 수 있도록 구성했습니다.\n\n홈페이지에서는 회사 소개와 제품 정보, 연구 성과를 확인하실 수 있습니다. 소식란에는 전시회 참가를 비롯한 회사의 주요 활동과 공지사항을 전하며, 채용 정보도 함께 안내합니다.\n\n이번 홈페이지가 MycoDx에 관심을 가져주시는 분들께 유용한 정보를 전하는 공간이 되기를 바랍니다. 앞으로 홈페이지를 통해 연구개발의 과정과 회사의 새로운 소식을 꾸준히 전하겠습니다. 많은 관심 부탁드립니다."
    },
    "translations": {
      "title": {
        "fr": "Le site officiel de MycoDx est désormais en ligne",
        "ja": "MycoDxの公式ウェブサイトを開設しました"
      },
      "summary": {
        "fr": "Nous avons lancé le site officiel de MycoDx afin de mieux présenter nos orientations de recherche, notre équipe, nos résultats scientifiques et les actualités de l’entreprise.",
        "ja": "MycoDxの研究方針、研究チーム、研究成果、会社のお知らせをより分かりやすくお伝えするため、公式ウェブサイトを開設しました。"
      },
      "body": {
        "fr": "Nous avons lancé le site officiel de MycoDx pour présenter nos recherches, nos technologies et les activités de l’entreprise. Il permet aux personnes qui découvrent MycoDx de mieux comprendre nos orientations et nos principaux domaines de recherche.\n\nVous y trouverez une présentation de l’entreprise, des informations sur nos produits et nos publications scientifiques. La rubrique Actualités présente nos principales activités, notamment nos participations à des salons et nos annonces, tandis que la rubrique Carrières rassemble les informations sur le recrutement.\n\nNous souhaitons faire de ce site une source d’information utile pour toutes les personnes qui s’intéressent à MycoDx. Nous continuerons à y partager l’avancement de nos travaux de recherche et développement ainsi que les dernières nouvelles de l’entreprise. Merci de votre intérêt et de votre soutien.",
        "ja": "MycoDxの研究・技術と会社の活動を紹介する公式ウェブサイトを開設しました。MycoDxを初めて知る方にも、当社が目指す方向性や主な研究分野をご覧いただける構成にしています。\n\nウェブサイトでは、会社紹介、製品情報、研究成果をご確認いただけます。お知らせ欄では展示会への出展をはじめとする会社の主な活動やご案内を掲載し、採用情報もお届けします。\n\nこのウェブサイトが、MycoDxに関心をお寄せくださる皆さまにとって役立つ情報を得られる場となれば幸いです。今後も研究開発の進捗や会社の最新情報を継続してお伝えしてまいります。どうぞよろしくお願いいたします。"
      }
    }
  },
  {
    "slug": "kimes-busan-2026",
    "postNumber": 2,
    "referenceKo": {
      "title": "MycoDx, KIMES BUSAN 2026 참가",
      "summary": "MycoDx가 2026년 10월 23일부터 25일까지 개최되는 제14회 부산국제의료기기전시회(KIMES BUSAN 2026)에 참가합니다.",
      "body": "MycoDx는 2026년 10월 23일부터 25일까지 열린 제14회 부산국제의료기기전시회(KIMES BUSAN 2026)에 참가해 통합 DST 플랫폼을 선보였습니다.\n\n이번에 소개한 통합 DST 플랫폼은 결핵 및 다제내성결핵의 약제감수성검사(DST)에 필요한 접종·배양·판독·기록 과정을 자동화하는 플랫폼입니다. 검사 과정의 각 단계를 하나로 연결하는 기술을 중심으로 MycoDx의 연구개발 방향을 소개했습니다.\n\n현장 부스에서는 플랫폼 소개 자료와 배양 이미지 분석 화면을 함께 전시했습니다. 관람객이 기술의 구성과 분석 예시를 살펴볼 수 있도록 전시를 구성하고, 결핵 진단 분야에서 MycoDx가 추진하는 검사 자동화 기술을 알렸습니다.",
      "imageAlt": "KIMES BUSAN 2026의 MycoDx 전시 부스. 회사 소개 패널과 배양 이미지 분석 화면, 전시 자료가 배치되어 있다."
    },
    "translations": {
      "title": {
        "fr": "MycoDx participe au KIMES BUSAN 2026",
        "ja": "MycoDx、KIMES BUSAN 2026に出展"
      },
      "summary": {
        "fr": "MycoDx participera à la 14e édition du Salon international des équipements médicaux de Busan (KIMES BUSAN 2026), qui se tiendra du 23 au 25 octobre 2026.",
        "ja": "MycoDxは、2026年10月23日から25日まで開催される第14回釜山国際医療機器展示会（KIMES BUSAN 2026）に出展します。"
      },
      "body": {
        "fr": "MycoDx a présenté sa plateforme intégrée de tests de sensibilité aux médicaments (DST) à la 14e édition du Salon international des équipements médicaux de Busan (KIMES BUSAN 2026), qui s’est tenue du 23 au 25 octobre 2026.\n\nCette plateforme automatise les étapes d’inoculation, de culture, d’interprétation et d’enregistrement nécessaires aux tests de sensibilité aux médicaments pour la tuberculose et la tuberculose multirésistante. MycoDx a présenté ses orientations de recherche et développement, en mettant l’accent sur une technologie reliant ces étapes au sein d’une même plateforme.\n\nLe stand réunissait des documents de présentation de la plateforme et un écran d’analyse d’images de culture. Les visiteurs ont ainsi pu découvrir le fonctionnement de la technologie et des exemples d’analyse, ainsi que les travaux de MycoDx sur l’automatisation des tests dans le diagnostic de la tuberculose.",
        "ja": "MycoDxは、2026年10月23日から25日まで開催された第14回釜山国際医療機器展示会（KIMES BUSAN 2026）に参加し、統合型DSTプラットフォームを紹介しました。\n\n今回紹介した統合型DSTプラットフォームは、結核および多剤耐性結核の薬剤感受性検査（DST）に必要な接種・培養・判読・記録の各工程を自動化するものです。検査工程の各段階を一つのプラットフォームでつなぐ技術を中心に、MycoDxの研究開発の方向性を紹介しました。\n\n会場のブースでは、プラットフォームの紹介資料と培養画像の解析画面を展示しました。来場者が技術の構成や解析例を確認できるようにし、結核診断の分野でMycoDxが取り組む検査自動化技術を紹介しました。"
      },
      "imageAlt": {
        "fr": "Stand de MycoDx au KIMES BUSAN 2026, avec un panneau de présentation de l’entreprise, un écran d’analyse d’images de culture et des documents d’exposition.",
        "ja": "KIMES BUSAN 2026のMycoDx展示ブース。会社紹介パネル、培養画像の解析画面、展示資料が設置されている。"
      }
    }
  },
  {
    "slug": "3",
    "postNumber": 3,
    "referenceKo": {
      "title": "마이코디엑스, ICID 2026에서 결핵 약제감수성검사 자동화 플랫폼 연구 발표",
      "summary": "마이코디엑스가 스페인 마드리드에서 열린 ICID 2026에 참가해 AI 기반 결핵 약제감수성검사 자동화 플랫폼 관련 연구를 포스터로 발표했습니다.",
      "body": "마이코디엑스(MycoDx)는 2026년 11월 10일부터 13일까지 스페인 마드리드에서 열린 제21회 국제감염병학회(ICID 2026)에 참가해 연구 성과를 발표했습니다.\n\n이번 학회에서는 다제내성 및 광범위 약제내성 결핵(MDR/XDR-TB)의 약제감수성검사(DST)를 자동화하기 위한 AI 기반 플랫폼의 개발 및 임상 평가 연구를 포스터로 발표했습니다.\n\n이 플랫폼은 6-well 고체배지 기반 검사에 자동 접종, 배양 및 AI 기반 집락 판독 기술을 통합하는 것을 목표로 합니다. 임상 검체에서 분리한 결핵균 53개 균주를 대상으로 비교 평가한 결과, 6-well 고체배지 기반 검사는 REMA 기준 검사법과 87.8%의 전체 약제감수성 판정 일치율을 보였습니다. AI 기반 집락 판독 성능에 대한 검증은 진행 중입니다.\n\n마이코디엑스는 앞으로도 검사 과정의 자동화와 표준화를 위한 플랫폼 개발 및 검증을 이어갈 계획입니다.",
      "imageAlt": "스페인 마드리드에서 열린 ICID 2026에 전시된 마이코디엑스의 결핵 약제감수성검사 자동화 플랫폼 연구 포스터."
    },
    "translations": {
      "title": {
        "fr": "MycoDx présente ses travaux sur une plateforme automatisée de tests de sensibilité aux antituberculeux à l’ICID 2026",
        "ja": "MycoDx、ICID 2026で結核薬剤感受性検査の自動化プラットフォームに関する研究を発表"
      },
      "summary": {
        "fr": "MycoDx a présenté un poster sur sa plateforme d’automatisation des tests de sensibilité aux antituberculeux fondée sur l’IA à l’ICID 2026, à Madrid, en Espagne.",
        "ja": "MycoDxはスペイン・マドリードで開催されたICID 2026に参加し、AIを活用した結核薬剤感受性検査の自動化プラットフォームに関する研究をポスター発表しました。"
      },
      "body": {
        "fr": "MycoDx a présenté ses travaux au 21e Congrès international sur les maladies infectieuses (ICID 2026), qui s’est tenu à Madrid, en Espagne, du 10 au 13 novembre 2026.\n\nL’entreprise a présenté un poster consacré au développement et à l’évaluation clinique d’une plateforme fondée sur l’IA pour automatiser les tests de sensibilité aux médicaments (DST) dans la tuberculose multirésistante et ultrarésistante (MDR/XDR-TB).\n\nCette plateforme vise à associer des tests sur milieu solide en plaques à six puits à l’inoculation automatisée, à l’incubation et à la lecture des colonies par IA. Lors d’une évaluation comparative portant sur 53 souches de bacilles tuberculeux isolées à partir d’échantillons cliniques, les tests sur milieu solide en plaques à six puits ont montré une concordance globale de 87,8 % avec la méthode de référence REMA pour les résultats de sensibilité aux médicaments. La validation des performances de lecture des colonies par IA est en cours.\n\nMycoDx poursuivra le développement et la validation de cette plateforme afin de contribuer à l’automatisation et à la standardisation des procédures de test.",
        "ja": "MycoDxは、2026年11月10日から13日までスペイン・マドリードで開催された第21回国際感染症学会（ICID 2026）に参加し、研究成果を発表しました。\n\n今回の学会では、多剤耐性結核および広範囲薬剤耐性結核（MDR/XDR-TB）の薬剤感受性検査（DST）を自動化するための、AIを活用したプラットフォームの開発と臨床評価に関する研究をポスター発表しました。\n\nこのプラットフォームは、6ウェルの固形培地を用いた検査に、自動接種、培養、AIによるコロニー判読技術を統合することを目指しています。臨床検体から分離した結核菌53株を対象とした比較評価では、6ウェルの固形培地を用いた検査の薬剤感受性判定は、参照法であるREMA法との全体一致率が87.8％でした。AIによるコロニー判読性能の検証は現在も進めています。\n\nMycoDxは今後も、検査工程の自動化と標準化に向けたプラットフォームの開発と検証を続けていく予定です。"
      },
      "imageAlt": {
        "fr": "Poster de MycoDx sur une plateforme automatisée de tests de sensibilité aux antituberculeux, présenté à l’ICID 2026 à Madrid, en Espagne.",
        "ja": "スペイン・マドリードで開催されたICID 2026に展示された、MycoDxの結核薬剤感受性検査自動化プラットフォームに関する研究ポスター。"
      }
    }
  },
  {
    "slug": "4",
    "postNumber": 4,
    "referenceKo": {
      "title": "MycoDx, CES 2027 참가 확정",
      "summary": "MycoDx의 CES 2027 참가가 확정되었습니다. 행사는 2027년 1월 6일부터 9일까지 미국 라스베이거스에서 개최됩니다.",
      "body": "MycoDx의 CES 2027 참가가 확정되었습니다. CES 2027은 2027년 1월 6일부터 9일까지 미국 라스베이거스에서 개최됩니다.\n\n부스 위치와 전시 내용 등 세부 참가 정보는 확정되는 대로 홈페이지 소식란을 통해 안내하겠습니다.\n\nCES 2027에서 전해드릴 MycoDx의 새로운 소식에 많은 관심 부탁드립니다."
    },
    "translations": {
      "title": {
        "fr": "MycoDx confirme sa participation au CES 2027",
        "ja": "MycoDx、CES 2027への出展が決定"
      },
      "summary": {
        "fr": "MycoDx a confirmé sa participation au CES 2027, qui se tiendra du 6 au 9 janvier 2027 à Las Vegas, aux États-Unis.",
        "ja": "MycoDxのCES 2027への出展が決定しました。2027年1月6日から9日まで、米国ラスベガスで開催されます。"
      },
      "body": {
        "fr": "MycoDx a confirmé sa participation au CES 2027. L’événement se tiendra du 6 au 9 janvier 2027 à Las Vegas, aux États-Unis.\n\nLes informations détaillées concernant notre participation, notamment l’emplacement du stand et les contenus présentés, seront annoncées dans la rubrique Actualités de notre site dès qu’elles seront confirmées.\n\nSuivez les prochaines actualités de MycoDx au CES 2027.",
        "ja": "MycoDxのCES 2027への出展が決定しました。CES 2027は、2027年1月6日から9日まで米国ラスベガスで開催されます。\n\nブースの位置や展示内容などの詳細は、確定次第、当社ウェブサイトのお知らせ欄でご案内します。\n\nCES 2027でお届けするMycoDxの最新情報に、どうぞご期待ください。"
      }
    }
  }
]$patches$::jsonb;
  patch jsonb;
  post public.news_posts%rowtype;
  snapshot_name text;
  field_name text;
  language_code text;
  snapshot jsonb;
  new_draft jsonb;
  new_published jsonb;
begin
  if current_user <> 'postgres' then raise exception 'Run as postgres'; end if;
  if exists (select 1 from recruit_private.migrations where version = '202611250003_news_fr_ja_translations') then
    raise notice 'Already applied. Existing content and publication status are unchanged.';
    return;
  end if;

  for patch in select value from jsonb_array_elements(patches) loop
    select * into post from public.news_posts
    where post_number = (patch ->> 'postNumber')::integer and slug = patch ->> 'slug'
    for update;
    if not found then
      raise exception 'News post % (%) was not found; no content changed.', patch ->> 'postNumber', patch ->> 'slug';
    end if;
    new_draft := post.draft;
    new_published := post.published;

    foreach snapshot_name in array array['draft', 'published'] loop
      snapshot := case when snapshot_name = 'draft' then post.draft else post.published end;
      if snapshot is null then continue; end if;
      for field_name in select jsonb_object_keys(patch -> 'translations') loop
        foreach language_code in array array['fr', 'ja'] loop
          if coalesce(btrim(snapshot #>> array[field_name, language_code]), '') = '' then
            -- Translate only the source revision reviewed with this migration.
            if (snapshot #>> array[field_name, 'ko']) is distinct from (patch #>> array['referenceKo', field_name]) then
              raise exception 'Korean % in post % % has changed. Review translations; no content changed.', field_name, post.post_number, snapshot_name;
            end if;
            snapshot := jsonb_set(snapshot, array[field_name, language_code], patch #> array['translations', field_name, language_code], true);
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
      where id = post.id;
    end if;
  end loop;
  insert into recruit_private.migrations (version) values ('202611250003_news_fr_ja_translations');
end
$migration$;
commit;

-- 각 글의 draft/published 행에서 fr_ready, ja_ready가 true인지 확인합니다.
-- 비공개 글은 draft만 반환합니다. 내용이 있는 대표 이미지 설명도 검사합니다.
select '/news/' || n.post_number as public_path,
  s.snapshot_name,
  n.published is not null as is_published,
  not exists (select 1 from unnest(array['title', 'summary', 'body', 'imageAlt']) as f(field_name)
    where coalesce(btrim(s.content #>> array[f.field_name, 'ko']), '') <> ''
      and coalesce(btrim(s.content #>> array[f.field_name, 'fr']), '') = '') as fr_ready,
  not exists (select 1 from unnest(array['title', 'summary', 'body', 'imageAlt']) as f(field_name)
    where coalesce(btrim(s.content #>> array[f.field_name, 'ko']), '') <> ''
      and coalesce(btrim(s.content #>> array[f.field_name, 'ja']), '') = '') as ja_ready
from public.news_posts n
cross join lateral (values ('draft', n.draft), ('published', n.published)) as s(snapshot_name, content)
where (n.post_number, n.slug) in ((1, 'website-launch'), (2, 'kimes-busan-2026'), (3, '3'), (4, '4'))
  and s.content is not null
order by n.post_number, s.snapshot_name;
