import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import BackToTopButton from '../common/BackToTopButton'
import PageMeta from '../common/PageMeta'
import Footer from './Footer'
import Header from './Header'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const isHome = location.pathname === '/'

  useEffect(() => {
    if (location.hash) return
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname, location.hash])

  return (
    <div className={isHome ? 'site-shell site-shell--home' : 'site-shell'}>
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
