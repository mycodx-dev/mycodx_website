import { useTranslation } from 'react-i18next'
import { localizePublicationText } from '../data/publications'
import usePublications from '../hooks/usePublications'

export default function Publication() {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const publications = usePublications()
  const publicationsByYear = [...new Set(publications.items.map(item => item.year))].sort((a,b)=>b-a)
    .map(year=>({year,items:publications.items.filter(item=>item.year===year)}))

  return (
    <div className="publication-page">
      <header className="publication-header">
        <p>{t('publication.kicker')}</p>
        <h1>{t('publication.title')}</h1>
        <span>{t('publication.description')}</span>
      </header>

      {publications.loading && <p role="status">{t('publication.loading')}</p>}
      {publications.error && <div role="alert"><p>{t('publication.loadError')}</p><button className="publication-link" onClick={publications.retry}>{t('publication.retry')}</button></div>}
      {!publications.loading && !publications.error && !publications.items.length && <p>{t('publication.empty')}</p>}

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
                <article key={publication.id} className="publication-item">
                  <h3>{publication.title}</h3>
                  <p className="publication-authors">{publication.authors}</p>

                  {publication.mycodxAuthors && <div className="publication-mycodx-authors">
                    <span>{t('publication.mycodxAuthors')}</span>
                    <strong>{publication.mycodxAuthors}</strong>
                  </div>}

                  <p className="publication-meta">
                    {publication.journal} ·{' '}
                    {[publication.year,
                      publication.volume && t('publication.volumeInfo', { volume: publication.volume }),
                      publication.article && t('publication.articleInfo', { article: publication.article }),
                    ].filter(Boolean).join(' · ')}
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
      {publications.hasMore && <button className="publication-link" disabled={publications.loadingMore} onClick={publications.more}>{t(publications.loadingMore?'publication.loading':'publication.more')}</button>}
    </div>
  )
}
