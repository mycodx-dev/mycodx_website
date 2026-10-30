import { useTranslation } from 'react-i18next'
import ResearchGrid from '../components/research/ResearchGrid'
import ResearchSectionHeader from '../components/research/ResearchSectionHeader'
import { researchProjects } from '../data/researchProjects'

export default function Research() {
  const { t } = useTranslation()

  return (
    <div className="research-page">
      <ResearchSectionHeader />

      <section className="research-page__intro">
        <div>
          <p className="research-kicker">{t('research.kicker')}</p>
          <h2>{t('research.title')}</h2>
          <p>{t('research.description')}</p>
        </div>
      </section>

      <section className="research-initiatives">
        <div className="research-initiatives__heading">
          <span>01</span>
          <div>
            <div className="research-initiatives__title-row">
              <h2>{t('research.initiativesTitle')}</h2>
              <p>
                {t('research.total')} <strong>{researchProjects.length}</strong>
              </p>
            </div>
            <p className="research-initiatives__description">
              {t('research.initiativesDescription')}
            </p>
          </div>
        </div>
        <ResearchGrid items={researchProjects} />
      </section>
    </div>
  )
}
