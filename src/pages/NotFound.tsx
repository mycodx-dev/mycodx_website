import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const messages = {
  ko: {
    kicker: '404 Error',
    title: '요청하신 페이지를 찾을 수 없습니다.',
    description: '주소가 변경되었거나 삭제된 페이지일 수 있습니다. 아래 링크를 이용해 주세요.',
    home: '홈으로 이동',
    contact: '문의하기',
  },
  en: {
    kicker: '404 Error',
    title: 'We could not find that page.',
    description: 'The address may have changed or the page may no longer exist. Use one of the links below.',
    home: 'Go to home',
    contact: 'Contact us',
  },
  fr: {
    kicker: 'Erreur 404',
    title: 'Cette page est introuvable.',
    description: "L’adresse a peut-être changé ou la page n’existe plus. Utilisez l’un des liens ci-dessous.",
    home: "Retour à l’accueil",
    contact: 'Nous contacter',
  },
  ja: {
    kicker: '404 Error',
    title: 'ページが見つかりません。',
    description: 'URLが変更されたか、ページが削除された可能性があります。以下のリンクをご利用ください。',
    home: 'ホームへ戻る',
    contact: 'お問い合わせ',
  },
} as const

export default function NotFound() {
  const { i18n } = useTranslation()
  const language = i18n.resolvedLanguage?.split('-')[0] ?? i18n.language.split('-')[0]
  const message = messages[language as keyof typeof messages] ?? messages.ko

  return (
    <main className="not-found-page">
      <p>{message.kicker}</p>
      <h1>{message.title}</h1>
      <span>{message.description}</span>
      <div>
        <Link to="/">{message.home}</Link>
        <Link to="/#contact">{message.contact}</Link>
      </div>
    </main>
  )
}
