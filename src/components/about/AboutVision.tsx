import { useTranslation } from 'react-i18next'

const visionPillars = ['validation', 'scalability', 'global'] as const

export default function AboutVision() {
  const { t } = useTranslation()

  return (
    <section className="about-vision" aria-labelledby="about-vision-title">
      <div className="about-section-heading">
        <span>03</span>
        <div>
          <p className="about-kicker">{t('about.vision.kicker')}</p>
          <h2 id="about-vision-title">{t('about.vision.title')}</h2>
        </div>
      </div>

      <article className="mission-panel">
        <div>
          <span>Mission</span>
        </div>
        <div>
          <h3>{t('about.mission.title')}</h3>
          <p>{t('about.mission.description')}</p>
        </div>
      </article>

      <div className="vision-heading">
        <span>Vision</span>
        <div>
          <h3>{t('about.vision.statement')}</h3>
          <p>{t('about.vision.description')}</p>
        </div>
      </div>

      <ol className="vision-pillars">
        {visionPillars.map((pillar, index) => (
          <li key={pillar}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <h4>{t(`about.vision.pillars.${pillar}.title`)}</h4>
            <p>{t(`about.vision.pillars.${pillar}.description`)}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
