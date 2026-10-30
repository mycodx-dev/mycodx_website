import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import careersTeamImage from '../assets/mycodx-careers-team-v2.jpg'

export default function Careers() {
  const { t } = useTranslation()
  const fields = t('careers.fields', { returnObjects: true }) as [string, string][]
  const steps = t('careers.steps', { returnObjects: true }) as [string, string, string][]

  return (
    <div className="careers-page">
      <header className="careers-hero">
        <div className="careers-hero__copy">
          <p className="careers-kicker">{t('careers.kicker')}</p>
          <h1>
            <Trans i18nKey="careers.title" components={{ line: <span />, strong: <strong /> }} />
          </h1>
          <p className="careers-hero__lead">{t('careers.lead')}</p>
          <div className="careers-hero__actions">
            <Link to="/careers/apply">{t('careers.ctaButton')}<span aria-hidden="true">→</span></Link>
          </div>
        </div>
        <figure className="careers-hero__visual">
          <img src={careersTeamImage} alt={t('careers.heroAlt')} />
        </figure>
      </header>

      <section className="careers-intro" id="talent-pool">
        <p className="careers-section-label"><b>01</b>{t('careers.introLabel')}</p>
        <div>
          <h2>
            <Trans i18nKey="careers.introTitle" components={{ line: <span />, strong: <strong /> }} />
          </h2>
          <div className="careers-intro__body">
            <p>
              <Trans i18nKey="careers.introBody" components={{ strong: <strong /> }} />
            </p>
            <small>{t('careers.notice')}</small>
          </div>
        </div>
      </section>

      <section className="careers-fields" id="career-fields">
        <div className="careers-section-heading">
          <p className="careers-section-label"><b>02</b>{t('careers.fieldsLabel')}</p>
          <div><h2>{t('careers.fieldsTitle')}</h2><p>{t('careers.fieldsDescription')}</p></div>
        </div>
        <div className="careers-field-grid">
          {fields.map(([title, description], index) => (
            <article key={title} className="careers-field-card">
              <span>0{index + 1}</span><h3>{title}</h3><p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="careers-process" id="talent-process">
        <div className="careers-section-heading">
          <p className="careers-section-label"><b>03</b>{t('careers.processLabel')}</p>
          <div><h2>{t('careers.processTitle')}</h2><p>{t('careers.processDescription')}</p></div>
        </div>
        <ol>
          {steps.map(([number, title, description]) => (
            <li key={number}><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div></li>
          ))}
        </ol>
      </section>

      <section className="careers-cta">
        <p>{t('careers.ctaEyebrow')}</p>
        <h2>{t('careers.ctaTitle').split('\n').map((line) => <span key={line}>{line}</span>)}</h2>
        <span>{t('careers.ctaBody')}</span>
        <Link to="/careers/apply">{t('careers.ctaButton')}</Link>
      </section>
    </div>
  )
}
