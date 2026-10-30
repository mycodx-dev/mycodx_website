import { useTranslation } from 'react-i18next'
import NewsCard from '../components/news/NewsCard'
import newsData from '../content/news.json'
import { localize, type NewsContent } from '../content/types'

const newsItems = newsData as NewsContent[]

function formatNewsDate(dateValue: string, language: string) {
  const [year, month] = dateValue.split('-')

  if (!year || !month) {
    return dateValue
  }

  if (language.startsWith('ko')) {
    return `${year}.${month}`
  }

  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1))
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export default function News() {
  const { t, i18n } = useTranslation()
  const visibleNews = newsItems
    .filter((item) => item.visible !== false)
    .sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="editorial-page news-page">
      <header className="editorial-page__header">
        <p>{t('newsPage.kicker')}</p>
        <h1>{t('newsPage.title')}</h1>
        <span>{t('newsPage.description')}</span>
      </header>

      {visibleNews.length > 0 ? (
        <div className="editorial-list">
          {visibleNews.map((item) => (
            <NewsCard
              key={item.id}
              date={formatNewsDate(item.date, i18n.language)}
              dateTime={item.date}
              title={localize(item.title, i18n.language)}
              summary={localize(item.summary, i18n.language)}
              category={item.category}
              id={item.id}
            />
          ))}
        </div>
      ) : (
        <div className="editorial-empty">
          <p>{t('newsPage.empty')}</p>
        </div>
      )}
    </div>
  )
}
