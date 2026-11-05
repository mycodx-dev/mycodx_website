import { useEffect, type ReactNode, type SyntheticEvent } from 'react'
import { useLocation } from 'react-router-dom'
import BackToTopButton from '../common/BackToTopButton'
import PageMeta from '../common/PageMeta'
import Footer from './Footer'
import Header from './Header'
import { preloadPage } from '../../routes/pageModules'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const isHome = location.pathname === '/'
  const prepareNavigation = (event: SyntheticEvent) => {
    const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null
    if (!anchor || anchor.origin !== window.location.origin || anchor.target === '_blank') return
    preloadPage(anchor.pathname)
  }

  useEffect(() => {
    if (location.hash) return
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname, location.hash])

  if (location.pathname === '/admin' || location.pathname === '/admin/') {
    return <><PageMeta />{children}</>
  }

  return (
    <div className={isHome ? 'site-shell site-shell--home' : 'site-shell'}
      onPointerOver={prepareNavigation} onFocusCapture={prepareNavigation} onTouchStart={prepareNavigation}>
      <PageMeta />
      <Header />
      <div
        key={location.pathname}
        className={isHome ? 'route-content route-content--home' : 'inner-page route-content'}
      >
        {children}
      </div>
      <Footer />
      <BackToTopButton />
    </div>
  )
}
