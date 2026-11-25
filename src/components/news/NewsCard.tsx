import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface NewsCardProps {
  title: string
  date: string
  dateTime?: string
  summary: string
  category?: string
  id: string
}

export default function NewsCard({
  title,
  date,
  dateTime = date,
  summary,
  category = 'News',
  id,
}: NewsCardProps) {
  const { t } = useTranslation()
  const content = (
    <>
      <div className="news-card__meta">
        <time dateTime={dateTime}>{date}</time>
        <span>{category}</span>
      </div>
      <h3>{title}</h3>
      <p>{summary}</p>
      <span className="news-card__more">{t('newsPage.readMore')} <span aria-hidden="true">↗</span></span>
    </>
  )

  return (
    <Link className="editorial-card news-card" to={`/news/${encodeURIComponent(id)}`}>
      {content}
    </Link>
  )
}
