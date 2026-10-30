import { useTranslation } from 'react-i18next'
import petriCultureImage from '../assets/mycodx-petri-culture.jpg'
import AboutHistory from '../components/about/AboutHistory'
import AboutIntro from '../components/about/AboutIntro'
import AboutVision from '../components/about/AboutVision'

export default function About() {
  const { t } = useTranslation()

  return (
    <div className="about-page">
      <header className="about-hero">
        <div className="about-hero__copy">
          <p className="about-kicker">{t('about.kicker')}</p>
          <h2>{t('about.title')}</h2>
          <p className="about-hero__lead">{t('about.lead')}</p>
        </div>

        <figure className="about-hero__visual">
          <img src={petriCultureImage} alt={t('about.heroImageAlt')} />
          <figcaption>
            <span>Microbial Diagnostics</span>
            <strong>Culture Research</strong>
          </figcaption>
        </figure>
      </header>

      <AboutIntro />
      <AboutHistory />
      <AboutVision />
    </div>
  )
}
