import { useTranslation } from 'react-i18next'
import type { ResearchProject } from '../../data/researchProjects'
import { formatScientificNames } from '../common/ScientificName'

interface ResearchCardProps {
  project: ResearchProject
  index: number
}

export default function ResearchCard({ project, index }: ResearchCardProps) {
  const { t, i18n } = useTranslation()
  const isEnglish = i18n.language.startsWith('en')
  const title = isEnglish ? project.title.en || project.title.ko : project.title.ko
  const ministry = isEnglish ? project.ministry.en : project.ministry.ko

  return (
    <article className="research-project-card">
      <div className="research-project-card__rail">
        <span>{String(index + 1).padStart(2, '0')}</span>
        <strong>{project.yearRange}</strong>
      </div>

      <div className="research-project-card__content">
        <div className="research-project-card__meta">
          <span>{ministry}</span>
          {!isEnglish && project.program && <span>{project.program}</span>}
        </div>

        <div className="research-project-card__title">
          <span aria-hidden="true">—</span>
          <h3>{formatScientificNames(title)}</h3>
        </div>

        {!isEnglish && project.summary && (
          <p className="research-project-card__summary">
            {formatScientificNames(project.summary)}
          </p>
        )}

        <dl>
          <div>
            <dt>{t('research.period')}</dt>
            <dd>{project.period}</dd>
          </div>
          <div>
            <dt>{t('research.principalInvestigator')}</dt>
            <dd lang="ko">{project.principalInvestigator}</dd>
          </div>
          <div>
            <dt>{t('research.organization')}</dt>
            <dd lang="ko">{project.organization}</dd>
          </div>
        </dl>
      </div>
    </article>
  )
}
