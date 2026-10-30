import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'

export default function BackToTopButton() {
  const { t } = useTranslation()
  const location = useLocation()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const updateVisibility = () => {
      setIsVisible(window.scrollY > Math.max(420, window.innerHeight * 0.55))
    }

    updateVisibility()
    window.addEventListener('scroll', updateVisibility, { passive: true })
    return () => window.removeEventListener('scroll', updateVisibility)
  }, [location.pathname])

  return (
    <button
      type="button"
      className={`top-button ${isVisible ? 'is-visible' : ''}`}
      aria-label={t('home.backToTop')}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <span aria-hidden="true">↑</span>
      TOP
    </button>
  )
}
