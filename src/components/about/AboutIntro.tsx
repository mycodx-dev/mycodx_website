import { useTranslation } from 'react-i18next'
import camelliaMark from '../../assets/logo/mycodx-camellia-mark.png'

const diagnosticFocus = ['culture', 'ntm', 'resistance', 'imaging'] as const

export default function AboutIntro() {
  const { t } = useTranslation()

  return (
    <section className="about-intro" aria-labelledby="about-intro-title">
      <div className="about-section-heading">
        <span>01</span>
        <div>
          <p className="about-kicker">{t('about.intro.kicker')}</p>
          <h2 id="about-intro-title">{t('about.intro.title')}</h2>
        </div>
      </div>

      <div className="about-intro__grid">
        <div className="about-intro__content">
          <p>{t('about.intro.paragraph1')}</p>
          <p>{t('about.intro.paragraph2')}</p>
          <p>{t('about.intro.paragraph3')}</p>

          <ul className="about-focus-list" aria-label={t('about.focusLabel')}>
            {diagnosticFocus.map((item, index) => (
              <li key={item}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{t(`about.focus.${item}.title`)}</strong>
                  <small>{t(`about.focus.${item}.description`)}</small>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <aside className="camellia-card">
          <div className="camellia-card__mark" aria-hidden="true">
            <img src={camelliaMark} alt="" />
          </div>
          <p>{t('about.camellia.kicker')}</p>
          <h3>{t('about.camellia.title')}</h3>
          <span>{t('about.camellia.description')}</span>
        </aside>
      </div>
    </section>
  )
}
