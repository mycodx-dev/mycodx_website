import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import newsData from '../content/news.json'
import { localize, type NewsContent } from '../content/types'
import NotFound from './NotFound'

export default function NewsDetail() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const item = (newsData as NewsContent[]).find((news) => news.id === id && news.visible !== false)

  if (!item) return <NotFound />

  const title = localize(item.title, i18n.language)
  const body = item.body ? localize(item.body, i18n.language) : ''
  const relatedUrl = item.url && /^https?:\/\//i.test(item.url) ? item.url : undefined

  return (
    <article className="editorial-page news-detail">
      <Link className="news-detail__back" to="/news">← {t('newsPage.backToList')}</Link>
      <header className="editorial-page__header">
        <p>{t('newsPage.kicker')}</p>
        <h1>{title}</h1>
        <div className="news-card__meta">
          <time dateTime={item.date}>{item.date.replaceAll('-', '.')}</time>
          {item.category && <span>{item.category}</span>}
        </div>
        <span>{localize(item.summary, i18n.language)}</span>
      </header>
      {item.image && (
        <img className="news-detail__image" src={item.image}
          alt={item.imageAlt ? localize(item.imageAlt, i18n.language) : title} />
      )}
      {body.trim() && (
        <div className="news-detail__body">
          {body.split(/\n\s*\n/).filter((paragraph) => paragraph.trim()).map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      )}
      {!!item.photos?.length && (
        <section className="news-detail__photos" aria-labelledby="news-photos-heading">
          <h2 id="news-photos-heading">{t('newsPage.photos')}</h2>
          {item.photos.map((photo, index) => (
            <figure key={`${photo.image}-${index}`}>
              <img src={photo.image} alt={localize(photo.alt, i18n.language)} loading="lazy" />
              {photo.caption && <figcaption>{localize(photo.caption, i18n.language)}</figcaption>}
            </figure>
          ))}
        </section>
      )}
      <footer className="news-detail__footer">
        <Link className="news-detail__back" to="/news">← {t('newsPage.backToList')}</Link>
        {relatedUrl && <a href={relatedUrl} target="_blank" rel="noopener noreferrer">{t('newsPage.relatedLink')} ↗</a>}
      </footer>
    </article>
  )
}
