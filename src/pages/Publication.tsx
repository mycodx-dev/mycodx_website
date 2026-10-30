import { useTranslation } from 'react-i18next'
import { localizePublicationText, publicationsByYear } from '../data/publications'

export default function Publication() {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language

  return (
    <div className="publication-page">
      <header className="publication-header">
        <p>{t('publication.kicker')}</p>
        <h1>{t('publication.title')}</h1>
        <span>{t('publication.description')}</span>
      </header>

      <div className="publication-year-list" aria-label={t('publication.yearNavigation')}>
        {publicationsByYear.map(({ year }) => (
          <a key={year} href={`#publications-${year}`}>
            {year}
          </a>
        ))}
      </div>

      <div className="publication-groups">
        {publicationsByYear.map(({ year, items }) => (
          <section
            key={year}
            id={`publications-${year}`}
            className="publication-year-group"
            aria-labelledby={`publications-${year}-title`}
          >
            <h2 id={`publications-${year}-title`}>{year}</h2>

            <div className="publication-list">
              {items.map((publication) => (
                <article key={publication.doi} className="publication-item">
                  <h3>{publication.title}</h3>
                  <p className="publication-authors">{publication.authors}</p>

                  <div className="publication-mycodx-authors">
                    <span>{t('publication.mycodxAuthors')}</span>
                    <strong>{publication.mycodxAuthors}</strong>
                  </div>

                  <p className="publication-meta">
                    {publication.journal} ·{' '}
                    {t('publication.publicationInfo', {
                      year: publication.year,
                      volume: publication.volume,
                      article: publication.article,
                    })}
                  </p>
                  <p className="publication-description">
                    {localizePublicationText(publication.description, language)}
                  </p>

                  <a
                    className="publication-link"
                    href={publication.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('publication.viewPublication')} <span aria-hidden="true">→</span>
                  </a>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
