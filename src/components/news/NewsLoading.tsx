import { useTranslation } from 'react-i18next'
import { useNews } from '../../services/newsContext'
export default function NewsLoading(){
  const {error,retry}=useNews(),{t}=useTranslation()
  return <div className="editorial-empty"><p role={error?'alert':'status'}>{t(error?'newsPage.loadError':'newsPage.loading')}</p>{error&&<button type="button" onClick={retry}>{t('newsPage.retry')}</button>}</div>
}
