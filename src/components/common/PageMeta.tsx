import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import productData from '../../content/products.json'
import newsData from '../../content/news.json'
import { localize, type ProductContent, type NewsContent } from '../../content/types'

const SITE_URL = 'https://mycodx.com'
const SITE_NAME = 'MycoDx'

const routeMeta = [
  { path: '/about', titleKey: 'about.kicker', descriptionKey: 'about.lead' },
  { path: '/product', titleKey: 'product.title', descriptionKey: 'product.description' },
  { path: '/news', titleKey: 'newsPage.title', descriptionKey: 'newsPage.description' },
  { path: '/publications', titleKey: 'publication.title', descriptionKey: 'publication.description' },
  { path: '/careers', titleKey: 'careersMeta.title', descriptionKey: 'careersMeta.description' },
  { path: '/careers/apply', titleKey: 'careersMeta.applyTitle', descriptionKey: 'careersMeta.applyDescription' },
] as const

function setMeta(name: string, content: string, property = false) {
  const attribute = property ? 'property' : 'name'
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`)

  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, name)
    document.head.appendChild(element)
  }

  element.content = content
}

export default function PageMeta() {
  const location = useLocation()
  const { t, i18n } = useTranslation()

  useEffect(() => {
    const path = location.pathname
    const language = i18n.resolvedLanguage ?? i18n.language
    const productId = path.startsWith('/product/') ? path.slice('/product/'.length) : ''
    const product = (productData as ProductContent[]).find((item) => item.id === productId)
    const news = (newsData as NewsContent[]).find((item) =>
      item.visible !== false && path === `/news/${encodeURIComponent(item.id)}`
    )
    const route = routeMeta.find((item) => item.path === path)

    let pageTitle = `${SITE_NAME} | ${t('home.titleLine1')} ${t('home.titleLine2')}`
    let description = t('home.description').replace(/\s+/g, ' ').trim()
    let noIndex = false

    if (product) {
      pageTitle = `${localize(product.title, language)} | ${SITE_NAME}`
      description = localize(product.listSummary ?? product.summary, language)
    } else if (news) {
      pageTitle = `${localize(news.title, language)} | ${SITE_NAME}`
      description = localize(news.summary, language)
    } else if (route) {
      pageTitle = `${t(route.titleKey)} | ${SITE_NAME}`
      description = t(route.descriptionKey)
    } else if (path === '/privacy') {
      pageTitle = `${t('footer.privacy')} | ${SITE_NAME}`
      description = t('home.contact.form.privacyConsent')
    } else if (path !== '/') {
      pageTitle = `404 | ${SITE_NAME}`
      description = 'The requested page could not be found.'
      noIndex = true
    }

    const canonicalUrl = `${SITE_URL}${path === '/' ? '' : path}`

    document.title = pageTitle
    setMeta('description', description)
    setMeta('robots', noIndex ? 'noindex, nofollow' : 'index, follow')
    setMeta('og:title', pageTitle, true)
    setMeta('og:description', description, true)
    setMeta('og:url', canonicalUrl, true)
    setMeta('og:locale', language.replace('-', '_'), true)
    setMeta('twitter:title', pageTitle)
    setMeta('twitter:description', description)

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = canonicalUrl
  }, [i18n.language, i18n.resolvedLanguage, location.pathname, t])

  return null
}
