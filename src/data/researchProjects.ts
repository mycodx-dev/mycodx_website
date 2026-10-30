export interface LocalizedProjectText {
  ko: string
  en: string
}

export interface ResearchProject {
  id: string
  latestYear: number
  yearRange: string
  period: string
  ministry: LocalizedProjectText
  program: string
  title: LocalizedProjectText
  summary: string
  principalInvestigator: string
  organization: string
  sourceRows: number
}

/** Generated from list.xls. Annual records with the same Korean project title are grouped. */
export const researchProjects: ResearchProject[] = [
  {
    "id": "project-01",
    "latestYear": 2026,
    "yearRange": "2025–2029",
    "period": "2025.04.01 - 2029.12.31",
    "ministry": {
      "ko": "보건복지부",
      "en": "Ministry of Health and Welfare"
    },
    "program": "감염병예방치료기술개발사업(R&D)",
    "title": {
      "ko": "바이오마커 발굴, 결핵의 유형별 질환 정도별 다중 진단 시스템 개발",
      "en": "Discovery of biomarkers, development of multiple diagnostic system for phases of tuberculosis and disease treatment"
    },
    "summary": "신규 바이오마커 발굴 및 패널구성/ 데이터베이스 구축, 바이오마커 동시 진단을 위한 진단 시스템 개발 · 해외 특허 출원(PCT 포함) 1건",
    "principalInvestigator": "류성원",
    "organization": "국립창원대학교 산학협력단",
    "sourceRows": 2
  },
  {
    "id": "project-03",
    "latestYear": 2024,
    "yearRange": "2018–2025",
    "period": "2018.06.01 - 2025.02.28",
    "ministry": {
      "ko": "과학기술정보통신부",
      "en": "Ministry of Science and ICT"
    },
    "program": "집단연구지원",
    "title": {
      "ko": "결핵 정밀맞춤치료 선도연구센터",
      "en": "Center for Personalized Precision Medicine of Tuberculosis (cPMTb)"
    },
    "summary": "최종 목표 및 비전 · 결핵 퇴치 위한 개인별 정밀맞춤 항결핵제 치료 기술 개발 및 이의 실용화항결핵제 정밀맞춤의료에 특화된 아시아 선도 전문 연구센터 구축",
    "principalInvestigator": "신재국",
    "organization": "인제대학",
    "sourceRows": 2
  },
  {
    "id": "project-04",
    "latestYear": 2024,
    "yearRange": "2022–2024",
    "period": "2022.08.22 - 2024.12.31",
    "ministry": {
      "ko": "질병관리청",
      "en": "Korea Disease Control and Prevention Agency"
    },
    "program": "감염병관리기술개발연구(R&D)",
    "title": {
      "ko": "다중 오믹스 기반 다제내성결핵 신약 후보 예측 연구",
      "en": "A multi-omics based prediction of new drug candidates for the multidrug-resistant tuberculosis treatment"
    },
    "summary": "오믹스 기반의 다제내성결핵 신약 표적 발굴 및 유효약물 후보물질 예측",
    "principalInvestigator": "박준형",
    "organization": "(주)쓰리빅스",
    "sourceRows": 3
  },
  {
    "id": "project-05",
    "latestYear": 2023,
    "yearRange": "2022–2024",
    "period": "2022.04.01 - 2024.12.31",
    "ministry": {
      "ko": "보건복지부",
      "en": "Ministry of Health and Welfare"
    },
    "program": "감염병의료안전강화기술개발사업",
    "title": {
      "ko": "감염성 바이오에어로졸 특성분석 및 센서 성능 평가",
      "en": "Infectious bioaerosol characterization and sensor performance evaluation"
    },
    "summary": "최종목표: 의료현장 감염병 안정성 강화를 위한 디지털 환경데이터 기반 AI 방역공조 시스템 개발 세부목표 디지털트윈 기반 의료현장 바이오에어로졸 확산 분석 및 방역공조기기 운영 시나리오 개발 (재료연) 디지털트윈 기반 감염병 확산 위험도 실시간 알림 시스템 개발 (온품) 실시간 의료현장 모니터링용 복합환경센서 개발…",
    "principalInvestigator": "류성원",
    "organization": "국립마산병원",
    "sourceRows": 2
  },
  {
    "id": "project-09",
    "latestYear": 2022,
    "yearRange": "2020–2022",
    "period": "2020.07.16 - 2022.12.31",
    "ministry": {
      "ko": "보건복지부",
      "en": "Ministry of Health and Welfare"
    },
    "program": "의료데이터 보호·활용 기술개발",
    "title": {
      "ko": "결핵 및 결핵검진 관리 현황과 문제점 분석",
      "en": "Analysis of tuberculosis burden, screening, and management status"
    },
    "summary": "결핵유병자, 발생자, 사망자의 도출을 통한 현 결핵질병부담 확인 · 결핵 검진 및 확진 후 추가 검사 및 치료 현황확인",
    "principalInvestigator": "이승헌",
    "organization": "고려대학교산학협력단",
    "sourceRows": 3
  },
  {
    "id": "project-10",
    "latestYear": 2022,
    "yearRange": "2020–2022",
    "period": "2020.03.02 - 2022.12.31",
    "ministry": {
      "ko": "보건복지부",
      "en": "Ministry of Health and Welfare"
    },
    "program": "감염병관리기술개발연구",
    "title": {
      "ko": "차세대염기서열분석 기반의 항결핵제 감수성 검사 실용화 연구",
      "en": "A study on the practical use of next generation sequencing (NGS) based drug susceptibility test"
    },
    "summary": "총괄: NGS-DST 임상평가 시행 및 제품 개선 - (1세부과제/서울의과학연구소): 임상연구 시행 및 NGS-DST 검사 실시 최종 개발품에 대한 성능평가 완료 임상연구 IRB 신청 임상연구를 지원하고 자료를 수집 임상 사이트에서 환자 검체를 수거하여 NGS 분석 실시 불일치 결과 혹은 새로운 돌연변이에 대해서는 특성…",
    "principalInvestigator": "김창기",
    "organization": "(재)서울의과학연구소",
    "sourceRows": 3
  },
  {
    "id": "project-11",
    "latestYear": 2021,
    "yearRange": "2020–2027",
    "period": "2020.09.01 - 2027.04.30",
    "ministry": {
      "ko": "산업통상자원부",
      "en": "Ministry of Trade, Industry and Energy"
    },
    "program": "산업기술알키미스트프로젝트",
    "title": {
      "ko": "3차원 바이러스 트랩퍼 센서 기반 호기 바이러스 비접촉 현장 자동진단 시스템 개발",
      "en": "Development of On site In situ and Untact Respiratory Virus Detection System Using 3D Airborne Virus Trapper Sensor"
    },
    "summary": "최종목표 달성을 위해 2단계 1차년도에 다음과 같은 개발목표를 설정하여 진행할 예정임. · 3차원 바이러스 센서 칩 최적화: Au 나노딤플 및 나노필라 구조의 최적화 공정을 개발할 예정임.",
    "principalInvestigator": "박성규",
    "organization": "한국재료연구원",
    "sourceRows": 2
  },
  {
    "id": "project-12",
    "latestYear": 2021,
    "yearRange": "2020–2022",
    "period": "2020.10.06 - 2022.03.31",
    "ministry": {
      "ko": "보건복지부",
      "en": "Ministry of Health and Welfare"
    },
    "program": "감염병 예방‧치료 기술개발(사업단)",
    "title": {
      "ko": "BCG 균주 대량생산 공정 확립 및 마이크로니들 기반 패치형 결핵 백신 성능 검증",
      "en": "Establishing mass production process of BCG strain and efficacy tests of tuberculosis vaccine-coated microneedle patches"
    },
    "summary": "균주원액 대량생산 기반구축과 제형 변경에 따른 접종량 개발 · 제형변경에 필요한 균주 생산 및 균주 원액에 대한 평가",
    "principalInvestigator": "류성원",
    "organization": "국립마산병원",
    "sourceRows": 2
  },
  {
    "id": "project-15",
    "latestYear": 2021,
    "yearRange": "2020–2021",
    "period": "2020.04.23 - 2021.12.31",
    "ministry": {
      "ko": "보건복지부",
      "en": "Ministry of Health and Welfare"
    },
    "program": "감염병 예방‧치료 기술개발",
    "title": {
      "ko": "천연물 유래 화합물 (Micrococcin P2)을 활용한 NTM 치료제 개발",
      "en": "Development of NTM Treatments Using Natural Origin Compound Micrococin P2"
    },
    "summary": "본 연구의 최종목표는 새로운 항생제를 개발함에 있어서 기존의 macrolide 계열의 항생제에 내성을 가지는, 병원성의 위험이 높은 Mycobacterium avium과 같은 비결핵항산균 (Non-tuberculosis Mycobacterium)에 대한 항균 잠재능력이 있는 Micrococcin P2 (MP-2)를 선도…",
    "principalInvestigator": "이다겸",
    "organization": "국립마산병원",
    "sourceRows": 2
  },
  {
    "id": "project-21",
    "latestYear": 2020,
    "yearRange": "2020–2020",
    "period": "2020.02.28 - 2020.12.31",
    "ministry": {
      "ko": "보건복지부",
      "en": "Ministry of Health and Welfare"
    },
    "program": "감염병관리기술개발연구",
    "title": {
      "ko": "국내 임상분리 결핵균 수집 및 특성 분석",
      "en": "The collection and characterization of clinical strains of Mycobacterium tuberculosis from Korea"
    },
    "summary": "국내 임상분리 결핵균을 체계적, 지속적으로 수집하여 자원화 함",
    "principalInvestigator": "장철훈",
    "organization": "부산대학교 산학협력단",
    "sourceRows": 1
  },
  {
    "id": "project-22",
    "latestYear": 2019,
    "yearRange": "2019–2021",
    "period": "2019.09.01 - 2021.12.31",
    "ministry": {
      "ko": "과학기술정보통신부",
      "en": "Ministry of Science and ICT"
    },
    "program": "국제연구인력교류(R&D)",
    "title": {
      "ko": "선도물질을 활용한 잠복결핵 치료제 개발",
      "en": "Development of anti-persistent tuberculosis drug using lead conpounds"
    },
    "summary": "전세계적으로 결핵은 감염성 질환 중 AIDS에 이어 성인 사망원인의 두번째를 차지하고 있는 심각한 질환임. 2018년 세계보건기구(WHO)의 보고에 따르면 2017년 한 해 동안 198개 국가로부터 신고된 결핵환자 중 신환자는 646만명이며 이 중 전염성이 높은 도말양성 환자는 약 362만명에 달하고 있음. 이중…",
    "principalInvestigator": "류성원",
    "organization": "국립마산병원",
    "sourceRows": 1
  },
  {
    "id": "project-24",
    "latestYear": 2015,
    "yearRange": "2013–2016",
    "period": "2013.07.01 - 2016.06.30",
    "ministry": {
      "ko": "보건복지부",
      "en": "Ministry of Health and Welfare"
    },
    "program": "감염병위기대응기술개발",
    "title": {
      "ko": "미세유체시스템의 결핵균배양 및 약제감수성시험 실제적용 가능성 검증",
      "en": "Evaluation of rapid Mycobacterium tuberculosis diagnosis system based on microfluidic and imaging technologies"
    },
    "summary": "신개념의 결핵균 배양검사 시스템 구축 (3~5일 이내 결핵균 검출) · 다제내성, 광역내성 결핵균의 동시 진단이 가능한 항결핵약제 감수성시험법 구축",
    "principalInvestigator": "류성원",
    "organization": "결핵연구원",
    "sourceRows": 3
  },
  {
    "id": "project-25",
    "latestYear": 2014,
    "yearRange": "2010–2015",
    "period": "2010.09.01 - 2015.08.31",
    "ministry": {
      "ko": "교육부",
      "en": "Ministry of Education"
    },
    "program": "일반연구자지원",
    "title": {
      "ko": "결핵균의 과산화수소분해효소, 과산화효소 활성 분석과 아이소나이아지드 약제내성에 관한 연구",
      "en": "Study on Mycobacterium tuberculosis catalase and peroxidase activities and isoniazid resistance"
    },
    "summary": "결핵균의 catalase-peroxidase 기능과 숙주 세포의 ROI 방어 메카니즘에 대항하는 alkyl hydroperoxide reductase 효소의 역할에 대한 구체적인 이해를 위해 다수의 실제 임상분리 결핵균주들과 재조합 돌연변이 마이코박테리아 균주들의 KatG와 AhpC 발현 레벨을 정확하게 측정하고 기능적…",
    "principalInvestigator": "류성원",
    "organization": "대한결핵협회 결핵연구원",
    "sourceRows": 5
  },
  {
    "id": "project-26",
    "latestYear": 2014,
    "yearRange": "2013–2015",
    "period": "2013.07.01 - 2015.06.30",
    "ministry": {
      "ko": "보건복지부",
      "en": "Ministry of Health and Welfare"
    },
    "program": "감염병위기대응기술개발",
    "title": {
      "ko": "항결핵 신약표적물질의 in vitro 활성 검증",
      "en": "Assessment of novel intracellualr specific-drug candidate against M/XDR TB"
    },
    "summary": "1. 임상분리 결핵균주, 비결핵항산성균를 대상으로하는 신약후보 물질의 in vitro 효력검증 · 2. 표준균주 (마이코박테리아)를 대상으로 신약후보 물질의 약물효력 검증",
    "principalInvestigator": "류성원",
    "organization": "결핵연구원",
    "sourceRows": 2
  },
  {
    "id": "project-33",
    "latestYear": 2011,
    "yearRange": "2011–2011",
    "period": "2011.02.16 - 2011.11.15",
    "ministry": {
      "ko": "보건복지부",
      "en": "Ministry of Health and Welfare"
    },
    "program": "질병관리연구지원",
    "title": {
      "ko": "항결핵약제 내성률 및 내성 유전자 변이 조사 (6차년도)",
      "en": ""
    },
    "summary": "1. 항결핵약제 감수성 검사 실시 · 2. 국내 항결핵약제 감수성 검사기관들과 네트 유지",
    "principalInvestigator": "류성원",
    "organization": "대한결핵협회 결핵연구원",
    "sourceRows": 1
  },
  {
    "id": "project-35",
    "latestYear": 2010,
    "yearRange": "2010–2012",
    "period": "2010.09.01 - 2012.08.31",
    "ministry": {
      "ko": "교육과학기술부",
      "en": "Ministry of Education, Science and Technology"
    },
    "program": "해외협력기반조성사업",
    "title": {
      "ko": "결핵균 지노타이핑을 위한 국제협력 연구",
      "en": "Global study of Mycobacterium tuberculosis genotyping"
    },
    "summary": "",
    "principalInvestigator": "류성원",
    "organization": "대한결핵협회 결핵연구원",
    "sourceRows": 1
  },
  {
    "id": "project-36",
    "latestYear": 2010,
    "yearRange": "2010–2010",
    "period": "2010.02.08 - 2010.11.07",
    "ministry": {
      "ko": "보건복지부",
      "en": "Ministry of Health and Welfare"
    },
    "program": "질병관리연구지원",
    "title": {
      "ko": "항결핵 약제별 내성률 조사 및 액체배지를 이용한 약제감수성 검사법 개선",
      "en": "Maintain laboratory based anti-mycobacterial drug resistance survey system and improve drug susceptibility testing with liquid media"
    },
    "summary": "2009년 이후 국내에 급속하게 보급이 늘어난 BD (Becton, Dickinson and Company)사의 MGIT 960 시스템에서 이루어지는 약제감수성검사법의 정확도를 기존의 고체배지인 L-J (L?wenstein-Jensen)를 이용한 방법과 비교 분석",
    "principalInvestigator": "류성원",
    "organization": "대한결핵협회 결핵연구원",
    "sourceRows": 1
  },
  {
    "id": "project-37",
    "latestYear": 2009,
    "yearRange": "2009–2010",
    "period": "2009.04.15 - 2010.01.14",
    "ministry": {
      "ko": "보건복지가족부",
      "en": "Ministry for Health, Welfare and Family Affairs"
    },
    "program": "질병관리연구 지원",
    "title": {
      "ko": "항결핵균제 내성 실태조사 및 2차 약제 감수성 검사법 개선",
      "en": "Construction of the antimycobacterial drug resistance survey system and improvement of 2nd line drug susceptibility testing"
    },
    "summary": "\"1. 항결핵약제 감수성 검사 실시 · 2. 국내 항결핵약제 감수성 검사기관들과의 네트웍 유지",
    "principalInvestigator": "류성원",
    "organization": "대한결핵협회 결핵연구원",
    "sourceRows": 1
  },
  {
    "id": "project-38",
    "latestYear": 2008,
    "yearRange": "2008–2009",
    "period": "2008.04.21 - 2009.01.20",
    "ministry": {
      "ko": "보건복지가족부",
      "en": "Ministry for Health, Welfare and Family Affairs"
    },
    "program": "(질병관리연구)질병관리연구",
    "title": {
      "ko": "항결핵균제 내성실태 및 내성균 진단법 개선 연구",
      "en": ""
    },
    "summary": "전 세계적으로 결핵은 감염성 질환 중 AIDS에 이어 성인 사망원인의 두 번째를 차지하고 있으며, 세계보건기구의 보고에 따르면 2004년도에 200개 국가로부터 신고 된 환자 수는 신환자가 약 450만 명이며 이중 전염성이 높은 도말양성 신환자만 약 200만 명에 달하고 있다. 결핵약제에 대한 정확한 내성률을 파악하고…",
    "principalInvestigator": "류성원",
    "organization": "대한결핵협회결핵연구원",
    "sourceRows": 2
  },
  {
    "id": "project-39",
    "latestYear": 2007,
    "yearRange": "2001–2008",
    "period": "2001.12.01 - 2008.03.01",
    "ministry": {
      "ko": "보건복지부",
      "en": "Ministry of Health and Welfare"
    },
    "program": "보건의료기술 연구개발",
    "title": {
      "ko": "호흡기계감염세균 유전체연구센터",
      "en": "Genome Research Center for Respiratory Pathogens"
    },
    "summary": "1) 주요호흡기계의 감염세균의 유전체연구를 통하여 진단, 치료, 예방백신 개발에 필요한 기반 기술과 연구인력을 확보함. · 2) 결핵균, 폐렴, 이코플라즈마균, 탄저균등 주요호흡기계 감염세균 유전체연구를 통하여 새로운 진단기술, 치료제 개발 및 예방백신 개발에활용할 물질을 확보함.",
    "principalInvestigator": "조상래",
    "organization": "연세대학교",
    "sourceRows": 5
  }
]
