import { Component } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

const messages = {
  ko: { loading: '페이지를 불러오는 중입니다.', failed: '페이지를 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.', retry: '다시 불러오기' },
  en: { loading: 'Loading page…', failed: 'Unable to load this page. Check your connection and try again.', retry: 'Reload page' },
  fr: { loading: 'Chargement de la page…', failed: 'Impossible de charger la page. Vérifiez votre connexion et réessayez.', retry: 'Recharger la page' },
  ja: { loading: 'ページを読み込んでいます。', failed: 'ページを読み込めませんでした。接続を確認してもう一度お試しください。', retry: '再読み込み' },
}

export function PageLoading({ failed = false }: { failed?: boolean }) {
  const { i18n } = useTranslation()
  const language = (i18n.resolvedLanguage ?? i18n.language).split('-')[0] as keyof typeof messages
  const message = messages[language] ?? messages.ko
  return <div className="editorial-empty" role={failed ? 'alert' : 'status'}>
    <p>{failed ? message.failed : message.loading}</p>
    {failed && <button type="button" onClick={() => window.location.reload()}>{message.retry}</button>}
  </div>
}

export default class PageLoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <PageLoading failed /> : this.props.children }
}
