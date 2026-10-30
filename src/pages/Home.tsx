import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  type TouchEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import collaborationImage from '../assets/mycodx-collaboration.jpg'
import heroAssayImage from '../assets/mycodx-hero-assay.jpg'
import heroCollaborationImage from '../assets/mycodx-hero-collaboration.jpg'
import heroCultureImage from '../assets/mycodx-hero-culture.jpg'
import productData from '../content/products.json'
import { localize, sortByOrder, type ProductContent } from '../content/types'
import { submitForm, SubmissionError } from '../services/formSubmission'
import useFormAvailability from '../hooks/useFormAvailability'

interface RevealProps {
  children: ReactNode
  className?: string
  delay?: number
}

const SLIDE_DURATION = 6000
const productItems = productData as ProductContent[]

function Reveal({ children, className = '', delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.unobserve(element)
        }
      },
      { threshold: 0.16 }
    )

    observer.observe(element)
    const visibilityFallback = window.setTimeout(() => {
      const bounds = element.getBoundingClientRect()
      if (bounds.top < window.innerHeight && bounds.bottom > 0) {
        setVisible(true)
      }
    }, 240)

    return () => {
      observer.disconnect()
      window.clearTimeout(visibilityFallback)
    }
  }, [])

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  )
}

export default function Home() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const touchStartX = useRef<number | null>(null)
  const [activeSlide, setActiveSlide] = useState(0)
  const [heroPaused, setHeroPaused] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [contactStatus, setContactStatus] = useState<
    'idle' | 'sending' | 'sent' | 'failed'
  >('idle')
  const contactPending = useRef(false)
  const [contactStartedAt] = useState(() => Date.now())
  const [contactError, setContactError] = useState('')
  const [contactReceipt, setContactReceipt] = useState('')
  const contactAvailable = useFormAvailability()

  const heroKeywordKeys = ['culture', 'integrated', 'intelligent'] as const
  const capabilityKeys = ['culture', 'detection', 'resistance', 'imaging'] as const
  const inquiryTypeKeys = ['research', 'product', 'validation', 'partnership', 'other'] as const
  const heroSlides = [
    {
      src: heroCultureImage,
      altKey: 'home.visuals.petriCulture',
    },
    {
      src: heroAssayImage,
      altKey: 'home.visuals.assay',
    },
    {
      src: heroCollaborationImage,
      altKey: 'home.visuals.collaboration',
    },
  ] as const
  const previewProducts = sortByOrder(
    productItems.filter((product) => product.visible !== false),
  ).slice(0, 3)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotionPreference = () => setReduceMotion(mediaQuery.matches)

    updateMotionPreference()
    mediaQuery.addEventListener('change', updateMotionPreference)

    return () => mediaQuery.removeEventListener('change', updateMotionPreference)
  }, [])

  useEffect(() => {
    if (heroPaused || reduceMotion) return

    const interval = window.setInterval(() => {
      if (!document.hidden) {
        setActiveSlide((current) => (current + 1) % heroSlides.length)
      }
    }, SLIDE_DURATION)

    return () => window.clearInterval(interval)
  }, [heroPaused, reduceMotion, heroSlides.length])

  useEffect(() => {
    if (reduceMotion) return

    const parallaxElements = Array.from(
      document.querySelectorAll<HTMLElement>('[data-parallax]')
    )
    let animationFrame = 0

    const updateParallax = () => {
      const viewportCenter = window.innerHeight / 2

      parallaxElements.forEach((element) => {
        const bounds = element.getBoundingClientRect()
        const elementCenter = bounds.top + bounds.height / 2
        const offset = Math.max(
          -32,
          Math.min(32, (viewportCenter - elementCenter) * 0.045)
        )

        element.style.setProperty('--parallax-y', `${offset}px`)
      })
    }

    const requestParallaxUpdate = () => {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = window.requestAnimationFrame(updateParallax)
    }

    updateParallax()
    window.addEventListener('scroll', requestParallaxUpdate, { passive: true })
    window.addEventListener('resize', requestParallaxUpdate)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('scroll', requestParallaxUpdate)
      window.removeEventListener('resize', requestParallaxUpdate)
    }
  }, [reduceMotion])

  useEffect(() => {
    if (!location.hash) return

    const timeout = window.setTimeout(() => {
      document.getElementById(location.hash.slice(1))?.scrollIntoView()
    }, 80)

    return () => window.clearTimeout(timeout)
  }, [location.hash])

  const showPreviousSlide = () => {
    setActiveSlide((current) => (
      current === 0 ? heroSlides.length - 1 : current - 1
    ))
  }

  const showNextSlide = () => {
    setActiveSlide((current) => (current + 1) % heroSlides.length)
  }

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null
    setHeroPaused(true)
  }

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const startX = touchStartX.current
    const endX = event.changedTouches[0]?.clientX

    touchStartX.current = null
    setHeroPaused(false)

    if (startX === null || endX === undefined) return

    const distance = endX - startX
    if (Math.abs(distance) < 48) return

    if (distance > 0) {
      showPreviousSlide()
    } else {
      showNextSlide()
    }
  }

  const handleContactSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    if (!contactAvailable || contactPending.current) return
    contactPending.current = true
    const data = new FormData(form)
    const value = (name: string) => String(data.get(name) ?? '')
    setContactStatus('sending')
    setContactError('')
    setContactReceipt('')
    try {
      const id = await submitForm({
        kind: 'contact', language: i18n.language.split('-')[0], startedAt: contactStartedAt,
        consent: data.has('privacy_consent'), website: value('_honey'),
        fields: { name: value('name'), email: value('email'), organization: value('organization'),
          inquiryType: value('inquiry_type'), message: value('message') },
      }, [], () => undefined)
      setContactReceipt(id)
      form.reset()
      setContactStatus('sent')
    } catch (error) {
      setContactError(error instanceof SubmissionError ? error.code : 'UNAVAILABLE')
      setContactReceipt(error instanceof SubmissionError ? error.receiptId ?? '' : '')
      setContactStatus('failed')
    } finally { contactPending.current = false }
  }

  return (
    <div className={`home-page ${location.hash ? 'home-page--hash' : ''}`}>
      <section
        className={`home-hero ${heroPaused ? 'is-paused' : ''}`}
        aria-labelledby="home-hero-title"
        aria-roledescription="carousel"
        onMouseEnter={() => setHeroPaused(true)}
        onMouseLeave={() => setHeroPaused(false)}
        onFocusCapture={() => setHeroPaused(true)}
        onBlurCapture={() => setHeroPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="home-visual">
          <div className="home-visual__images">
            {heroSlides.map((slide, index) => (
              <img
                key={slide.src}
                src={slide.src}
                alt={index === activeSlide ? t(slide.altKey) : ''}
                className={index === activeSlide ? 'is-active' : ''}
                aria-hidden={index !== activeSlide}
                fetchPriority={index === 0 ? 'high' : 'auto'}
              />
            ))}
          </div>
          <div className="home-visual__veil" />

          <div className="home-visual__copy">
            <h1 id="home-hero-title" className="home-visual__title">
              {t('home.titleLine1')}
              <span>{t('home.titleLine2')}</span>
            </h1>
            <p className="home-visual__description">{t('home.description')}</p>
            <ul className="home-hero-keywords" aria-label={t('home.keywords.label')}>
              {heroKeywordKeys.map((key) => (
                <li key={key}>{t(`home.keywords.${key}`)}</li>
              ))}
            </ul>
            <nav className="home-visual__actions" aria-label={t('home.cta.label')}>
              <Link to="/product" className="home-hero-cta home-hero-cta--primary">
                {t('home.cta.products')}
              </Link>
              <Link to="/#contact" className="home-hero-cta">
                {t('home.cta.contact')}
              </Link>
            </nav>
          </div>

          <div className="home-visual__scroll" aria-hidden="true">
            <span>{t('home.scroll')}</span>
            <i />
          </div>

          <div className="home-slider">
            <div className="home-slider__status" aria-live="polite">
              <strong>{String(activeSlide + 1).padStart(2, '0')}</strong>
              <span>/ {String(heroSlides.length).padStart(2, '0')}</span>
            </div>

            <div className="home-slider__progress" aria-hidden="true">
              <span
                key={`${activeSlide}-${heroPaused ? 'paused' : 'playing'}`}
                style={{ '--slide-duration': `${SLIDE_DURATION}ms` } as CSSProperties}
              />
            </div>

            <div className="home-slider__buttons">
              <button
                type="button"
                aria-label={t('home.slides.previous')}
                onClick={showPreviousSlide}
              >
                ←
              </button>
              <button
                type="button"
                aria-label={t('home.slides.next')}
                onClick={showNextSlide}
              >
                →
              </button>
            </div>
          </div>
        </div>
      </section>

      <main>
        <section id="focus" className="home-focus">
          <Reveal className="home-focus__heading">
            <p className="section-kicker">{t('home.focus.kicker')}</p>
            <h2>{t('home.focus.title')}</h2>
          </Reveal>

          <Reveal className="home-focus__body">
            <p>{t('home.focus.description')}</p>
            <Link to="/about" className="text-link">
              {t('home.focus.link')}
              <span aria-hidden="true">↗</span>
            </Link>
          </Reveal>
        </section>

        <section className="home-capabilities" aria-labelledby="capabilities-title">
          <Reveal className="home-capabilities__heading">
            <p className="section-kicker">{t('home.capabilities.kicker')}</p>
            <h2 id="capabilities-title">{t('home.capabilities.title')}</h2>
          </Reveal>

          <div className="home-capabilities__grid">
            {capabilityKeys.map((key, index) => (
              <Reveal
                key={key}
                className="capability-card"
                delay={index * 120}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3 lang="en">{t(`home.capabilities.${key}.title`)}</h3>
                <strong>{t(`home.capabilities.${key}.label`)}</strong>
                <p>{t(`home.capabilities.${key}.description`)}</p>
              </Reveal>
            ))}
          </div>

          <Reveal
            className="home-capabilities__note"
            delay={capabilityKeys.length * 120}
          >
            <strong lang="en">{t('home.capabilities.chain')}</strong>
            <p>{t('home.capabilities.platformMessage')}</p>
          </Reveal>
        </section>

        <section className="home-product-preview" aria-labelledby="home-product-preview-title">
          <Reveal className="home-product-preview__heading">
            <div>
              <p className="section-kicker">{t('home.pipeline.kicker')}</p>
              <h2 id="home-product-preview-title">{t('home.pipeline.title')}</h2>
            </div>
            <p>{t('home.pipeline.description')}</p>
          </Reveal>

          <Reveal className="home-product-preview__flow" delay={120}>
            {previewProducts.length > 0 && (
              <ol className="home-pipeline-flow">
                {previewProducts.map((product, index) => (
                  <li key={product.id}>
                    <Link to={`/product/${product.id}`}>
                      <span className="home-pipeline-flow__index">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="home-pipeline-flow__category">
                        {product.category ?? `Module ${String(index + 1).padStart(2, '0')}`}
                      </span>
                      <h3>{localize(product.title, i18n.language)}</h3>
                      {product.status && (
                        <strong>{localize(product.status, i18n.language)}</strong>
                      )}
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Reveal>

          <Reveal className="home-product-preview__footer" delay={240}>
            <p>{t('home.pipeline.note')}</p>
            <Link to="/product" className="text-link">
              {t('home.pipeline.link')}
              <span aria-hidden="true">↗</span>
            </Link>
          </Reveal>
        </section>

        <section className="home-story">
          <div className="home-story__image">
            <img
              src={collaborationImage}
              alt={t('home.visuals.collaboration')}
              data-parallax
            />
          </div>
          <Reveal className="home-story__content" delay={160}>
            <p className="section-kicker">{t('home.story.kicker')}</p>
            <h2>{t('home.story.title')}</h2>
            <p>{t('home.story.description')}</p>
            <Link to="/about" className="text-link text-link--light">
              {t('home.story.link')}
              <span aria-hidden="true">↗</span>
            </Link>
          </Reveal>
        </section>

        <section id="contact" className="home-contact">
          <div className="home-contact__background" aria-hidden="true">
            <img src={heroCultureImage} alt="" data-parallax />
          </div>
          <div className="home-contact__veil" aria-hidden="true" />

          <div className="home-contact__inner">
            <Reveal className="home-contact__heading">
              <p className="section-kicker">{t('home.contact.kicker')}</p>
              <h2 lang="en">{t('home.contact.title')}</h2>
              <p>{t('home.contact.description')}</p>
            </Reveal>

            <div className="home-contact__panels">
              <Reveal className="home-contact__summary">
                <p>{t('home.contact.prompt')}</p>
                <div className="home-contact__methods">
                  <a className="home-contact__method" href="mailto:info@mycodx.com">
                    <span>{t('home.contact.direct.email')}</span>
                    <strong lang="en">info@mycodx.com</strong>
                  </a>
                  <a className="home-contact__method" href="tel:+827086571848">
                    <span>{t('home.contact.direct.phone')}</span>
                    <strong lang="en">+82-70-8657-1848</strong>
                  </a>
                  <address className="home-contact__method home-contact__method--address">
                    <span>{t('home.contact.direct.office')}</span>
                    <strong>{t('home.contact.address')}</strong>
                  </address>
                </div>
                <div className="home-contact__map">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1629.343231176825!2d128.7001853310215!3d35.239174296577445!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3568cc7be42df32b%3A0x58106966d3b18ece!2z6rK97IOB64Ko64-EIOywveybkOyLnCDsnZjssL3qtawg7Jqp64-Z66GcODPrsojslYjquLggNw!5e0!3m2!1sko!2skr!4v1780626606710!5m2!1sko!2skr"
                    title={t('home.contact.mapTitle')}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                </div>
              </Reveal>

              <Reveal className="home-contact__form-wrap" delay={140}>
                <form className="home-contact__form" onSubmit={handleContactSubmit} aria-busy={contactStatus === 'sending'}>
                  <fieldset className="form-controls" disabled={contactStatus === 'sending'}>
                  <fieldset className="home-contact__topics">
                    <legend>{t('home.contact.form.inquiryType')}</legend>
                    <div>
                      {inquiryTypeKeys.map((key, index) => (
                        <label key={key}>
                          <input
                            type="radio"
                            name="inquiry_type"
                            value={t(`home.contact.form.inquiryTypes.${key}`)}
                            defaultChecked={index === 0}
                          />
                          <span>{t(`home.contact.form.inquiryTypes.${key}`)}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div className="home-contact__fields">
                    <label>
                      <span>{t('home.contact.form.name')}</span>
                      <input
                        type="text"
                        name="name"
                        placeholder={t('home.contact.form.namePlaceholder')}
                        autoComplete="name"
                        maxLength={100}
                        required
                      />
                    </label>
                    <label>
                      <span>{t('home.contact.form.email')}</span>
                      <input
                        type="email"
                        name="email"
                        placeholder="email@example.com"
                        autoComplete="email"
                        maxLength={254}
                        required
                      />
                    </label>
                    <label>
                      <span>{t('home.contact.form.organization')}</span>
                      <input
                        type="text"
                        name="organization"
                        placeholder={t('home.contact.form.organizationPlaceholder')}
                        autoComplete="organization"
                        maxLength={200}
                      />
                    </label>
                  </div>

                  <label>
                    <span>{t('home.contact.form.message')}</span>
                    <textarea
                      name="message"
                      rows={5}
                      maxLength={5000}
                      placeholder={t('home.contact.form.messagePlaceholder')}
                      required
                    />
                  </label>
                  <input type="text" name="_honey" className="careers-form__honeypot" tabIndex={-1} autoComplete="off" aria-hidden="true" />
                  <label className="home-contact__privacy-consent">
                    <input type="checkbox" name="privacy_consent" value="agreed" required />
                    <span>
                      {t('home.contact.form.privacyConsent')}{' '}
                      <Link to="/privacy" state={{ fromContact: true }}>
                        {t('home.contact.form.privacyLink')}
                      </Link>
                    </span>
                  </label>
                  </fieldset>
                  {contactAvailable !== true && <p className="home-contact__status" role="status">{t(contactAvailable === null ? 'forms.checkingAvailability' : 'forms.unavailable')} <a href="mailto:info@mycodx.com">info@mycodx.com</a></p>}
                  <div className="home-contact__form-footer">
                    <button type="submit" disabled={!contactAvailable || contactStatus === 'sending'}>
                      {contactStatus === 'sending'
                        ? t('home.contact.form.sending')
                        : contactError === 'DELIVERY_UNCERTAIN' ? t('forms.checkStatus') : t('home.contact.form.submit')}
                    </button>
                    <p
                      className={`home-contact__status ${
                        contactStatus === 'failed' ? 'is-error' : ''
                      }`}
                      aria-live="polite"
                    >
                      {contactStatus === 'sent' && `${t('forms.accepted')} ${t('forms.receipt', { id: contactReceipt })}`}
                      {contactStatus === 'failed' && <>{t(`forms.errors.${contactError}`, { defaultValue: t('home.contact.form.failed') })} {contactReceipt && t('forms.receipt', { id: contactReceipt })}</>}
                    </p>
                  </div>
                </form>
              </Reveal>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
