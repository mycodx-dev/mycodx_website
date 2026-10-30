import { paperRecords, patentRecords } from './publicationRecords'

export interface LocalizedText {
  ko: string
  en: string
  fr?: string
  ja?: string
}

export interface PublicationAuthor {
  name: string
  highlight?: boolean
}

export interface PaperPublication {
  id: string
  year: number | null
  title: LocalizedText
  journal: string
  publicationType?: string
  status?: LocalizedText
  authors: PublicationAuthor[]
  url?: string
}

export interface PatentPublication {
  id: string
  year: number
  title: LocalizedText
  inventors: string[]
  country: LocalizedText
  registrationNumber: string
  url?: string
}

export interface ResearchPublication {
  year: number
  title: string
  authors: string
  mycodxAuthors: string
  journal: string
  volume: string
  article: string
  description: LocalizedText
  doi: string
  url: string
}

export interface PublicationYearGroup {
  year: number
  items: ResearchPublication[]
}

export const researchPublications: ResearchPublication[] = [
  {
    year: 2026,
    title:
      'Evaluation of the GCdiaMTB/NTM real-time PCR kit according to the Korean in vitro diagnostic medical device approval standards',
    authors: 'Seo Yong Choe, Da-Gyum Lee, Jin-A Park, et al.',
    mycodxAuthors: 'Jin-A Park · JeongA Kim · Sungweon Ryoo',
    journal: 'Journal of Microbiological Methods',
    volume: '250',
    article: '107717',
    description: {
      ko: 'GCdiaMTB/NTM Real-Time PCR Kit의 결핵균군 및 비결핵항산균 진단 성능을 국내 체외진단의료기기 허가 기준에 따라 평가한 연구입니다.',
      en: 'A clinical performance evaluation of the GCdiaMTB/NTM Real-Time PCR Kit for detecting MTBC and NTM under Korean in vitro diagnostic medical device approval standards.',
      fr: "Une évaluation des performances cliniques du kit PCR en temps réel GCdiaMTB/NTM pour la détection du MTBC et des MNT selon les normes coréennes d'autorisation des dispositifs médicaux de diagnostic in vitro.",
      ja: '韓国の体外診断用医療機器の承認基準に基づき、GCdiaMTB/NTMリアルタイムPCRキットの結核菌群および非結核性抗酸菌の検出性能を評価した研究です。',
    },
    doi: '10.1016/j.mimet.2026.107717',
    url: '/papers/evaluation-gcdia-mtb-ntm-real-time-pcr-kit.pdf',
  },
  {
    year: 2026,
    title:
      'Metformin Modulates Ferroptosis-Related and Antioxidant Gene Expression in Brown Adipose Tissue',
    authors: 'Dong Soo Seo, Sungjun Park, Yusra Ahmad, et al.',
    mycodxAuthors: 'Jin-A Park · Sungweon Ryoo',
    journal: 'International Journal of Molecular Sciences',
    volume: '27',
    article: '7625',
    description: {
      ko: '갈색 지방 조직에서 metformin이 유도하는 항산화 및 ferroptosis 관련 경로 변화에 대한 연구입니다.',
      en: 'Research on metformin-induced changes in antioxidant and ferroptosis-related pathways in brown adipose tissue.',
      fr: "Recherche sur les changements induits par la metformine dans les voies antioxydantes et liées à la ferroptose du tissu adipeux brun.",
      ja: '褐色脂肪組織におけるmetformin誘導性の抗酸化およびferroptosis関連経路の変化に関する研究です。',
    },
    doi: '10.3390/ijms27177625',
    url: '/papers/metformin-ferroptosis-brown-adipose-tissue.pdf',
  },
]

export const sortedResearchPublications = [...researchPublications].sort((a, b) => b.year - a.year)

export const localizePublicationText = (value: LocalizedText, language: string) => {
  const languageCode = language.split('-')[0] as keyof LocalizedText

  return value[languageCode] || value.en || value.ko
}

export const publicationsByYear: PublicationYearGroup[] = Array.from(
  sortedResearchPublications.reduce((groups, publication) => {
    const items = groups.get(publication.year) ?? []
    items.push(publication)
    groups.set(publication.year, items)

    return groups
  }, new Map<number, ResearchPublication[]>()),
  ([year, items]) => ({ year, items }),
).sort((a, b) => b.year - a.year)

export const papers: PaperPublication[] = paperRecords
export const patents: PatentPublication[] = patentRecords
