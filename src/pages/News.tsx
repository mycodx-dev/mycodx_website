import { useTranslation } from 'react-i18next'
import NewsCard from '../components/news/NewsCard'
import { localize } from '../content/types'
import { useNews } from '../services/newsContext'
import NewsLoading from '../components/news/NewsLoading'
import { newsAddress } from '../../shared/news'

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
  const news=useNews()
  const visibleNews = news.items
    .filter((item) => item.visible !== false)
    .sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="editorial-page news-page">
      <header className="editorial-page__header">
        <p>{t('newsPage.kicker')}</p>
        <h1>{t('newsPage.title')}</h1>
        <span>{t('newsPage.description')}</span>
      </header>

      {news.loading || (news.error && !visibleNews.length) ? <NewsLoading/> : visibleNews.length > 0 ? (
        <div className="editorial-list">
          {visibleNews.map((item) => (
            <NewsCard
              key={item.id}
              date={formatNewsDate(item.date, i18n.language)}
              dateTime={item.date}
              title={localize(item.title, i18n.language)}
              summary={localize(item.summary, i18n.language)}
              category={item.category}
              id={newsAddress(item)}
            />
          ))}
        </div>
      ) : (
        <div className="editorial-empty">
          <p>{t('newsPage.empty')}</p>
        </div>
      )}
      {!!visibleNews.length&&news.error&&<NewsLoading/>}
      {news.hasMore&&<div className="editorial-empty"><button type="button" disabled={news.loadingMore} onClick={news.more}>{t(news.loadingMore?'newsPage.loading':'newsPage.more')}</button></div>}
    </div>
  )
}
