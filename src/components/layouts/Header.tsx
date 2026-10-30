import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import mycoDxLogo from '../../assets/logo/mycodx-wordmark.png'
import { homeNavigation } from '../../data/homeNavigation'

const languageOptions = [
  { code: 'ko', shortLabel: 'KO', label: '한국어' },
  { code: 'en', shortLabel: 'EN', label: 'English' },
  { code: 'fr', shortLabel: 'FR', label: 'Français' },
  { code: 'ja', shortLabel: 'JA', label: '日本語' },
] as const

const getLanguageCode = (language: string) => {
  const languageCode = language.split('-')[0]
  return languageOptions.some((option) => option.code === languageCode) ? languageCode : 'ko'
}

export default function Header() {
  const { i18n, t } = useTranslation()
  const location = useLocation()
  const [headerHidden, setHeaderHidden] = useState(false)
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false)
  const lastScrollY = useRef(0)
  const languageSelectorRef = useRef<HTMLDivElement>(null)
  const isHome = location.pathname === '/'
  const currentLanguageCode = getLanguageCode(i18n.resolvedLanguage ?? i18n.language)
  const currentLanguage =
    languageOptions.find((option) => option.code === currentLanguageCode) ?? languageOptions[0]

  useEffect(() => {
    if (!isHome) {
      lastScrollY.current = 0
      return
    }

    lastScrollY.current = window.scrollY

    const updateHeaderVisibility = () => {
      const currentScrollY = window.scrollY
      const scrollingDown = currentScrollY > lastScrollY.current

      if (currentScrollY < 32) {
        setHeaderHidden(false)
      } else if (scrollingDown && currentScrollY > 120) {
        setHeaderHidden(true)
      } else if (!scrollingDown) {
        setHeaderHidden(false)
      }

      lastScrollY.current = currentScrollY
    }

    window.addEventListener('scroll', updateHeaderVisibility, { passive: true })
    return () => window.removeEventListener('scroll', updateHeaderVisibility)
  }, [isHome])

  useEffect(() => {
    if (!languageMenuOpen) {
      return
    }

    const closeLanguageMenu = (event: PointerEvent) => {
      const target = event.target

      if (target instanceof Node && !languageSelectorRef.current?.contains(target)) {
        setLanguageMenuOpen(false)
      }
    }

    const closeLanguageMenuWithKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLanguageMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeLanguageMenu)
    document.addEventListener('keydown', closeLanguageMenuWithKeyboard)

    return () => {
      document.removeEventListener('pointerdown', closeLanguageMenu)
      document.removeEventListener('keydown', closeLanguageMenuWithKeyboard)
    }
  }, [languageMenuOpen])

  const selectLanguage = (languageCode: string) => {
    if (languageCode !== currentLanguageCode) {
      void i18n.changeLanguage(languageCode)
    }

    setLanguageMenuOpen(false)
  }

  const returnHome = () => {
    setHeaderHidden(false)
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
  }

  return (
    <header
      className={`site-header ${isHome ? 'site-header--home' : 'site-header--inner'} ${
        isHome && headerHidden ? 'site-header--hidden' : ''
      }`}
    >
      <div className="site-header__inner">
        <Link to="/" className="site-logo" aria-label="MycoDx home" onClick={returnHome}>
          <img src={mycoDxLogo} alt="MycoDx" />
        </Link>

        <div className="site-header__actions">
          <nav className="site-primary-nav" aria-label={t('header.primaryNav')}>
            {homeNavigation.map((item) => {
              const isActive = item.path === '/#contact'
                ? false
                : location.pathname === item.path

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={isActive ? 'is-active' : undefined}
                >
                  {t(item.titleKey)}
                </Link>
              )
            })}
          </nav>

          <div className="language-selector" ref={languageSelectorRef}>
            <button
              type="button"
              className="language-button"
              aria-label={t('header.changeLanguage')}
              aria-haspopup="menu"
              aria-expanded={languageMenuOpen}
              onClick={() => setLanguageMenuOpen((open) => !open)}
            >
              <span>{currentLanguage.shortLabel}</span>
              <span className="language-button__chevron" aria-hidden="true" />
            </button>

            {languageMenuOpen && (
              <div className="language-menu" role="menu" aria-label={t('header.changeLanguage')}>
                {languageOptions.map((language) => {
                  const isSelected = language.code === currentLanguageCode

                  return (
                    <button
                      type="button"
                      key={language.code}
                      className={`language-menu__item ${isSelected ? 'is-selected' : ''}`}
                      role="menuitemradio"
                      aria-checked={isSelected}
                      onClick={() => selectLanguage(language.code)}
                    >
                      <span className="language-menu__short">{language.shortLabel}</span>
                      <span className="language-menu__label">{language.label}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
