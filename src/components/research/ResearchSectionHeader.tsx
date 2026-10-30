import { useTranslation } from 'react-i18next'
import { Link, NavLink } from 'react-router-dom'

export default function ResearchSectionHeader() {
  const { t } = useTranslation()

  return (
    <header className="research-section-header">
      <nav className="research-breadcrumb" aria-label={t('researchNavigation.breadcrumbAria')}>
        <Link to="/">Home</Link>
        <span aria-hidden="true">·</span>
        <span>Research</span>
      </nav>

      <div className="research-section-header__row">
        <h1>Research</h1>
        <nav className="research-tabs" aria-label={t('researchNavigation.aria')}>
          <NavLink
            to="/research/introduction"
            className={({ isActive }) => (isActive ? 'is-active' : undefined)}
          >
            {t('researchNavigation.introduction')}
          </NavLink>
          <NavLink
            to="/research/areas"
            className={({ isActive }) => (isActive ? 'is-active' : undefined)}
          >
            {t('researchNavigation.areas')}
          </NavLink>
        </nav>
      </div>
    </header>
  )
}
