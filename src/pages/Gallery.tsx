import { useTranslation } from 'react-i18next'
import galleryData from '../content/gallery.json'
import { localize, sortByOrder, type GalleryContent } from '../content/types'

const galleryItems = galleryData as GalleryContent[]

export default function Gallery() {
  const { t, i18n } = useTranslation()
  const visibleImages = sortByOrder(
    galleryItems.filter((image) => image.visible !== false),
  )

  return (
    <div className="gallery-page">
      <header>
        <p>{t('gallery.kicker')}</p>
        <h1>{t('gallery.title')}</h1>
        <span>{t('gallery.description')}</span>
      </header>

      {visibleImages.length > 0 ? (
        <div className="gallery-grid">
          {visibleImages.map((image, index) => (
            <figure key={image.id}>
              <img src={image.image} alt={localize(image.alt, i18n.language)} />
              <figcaption>
                {String(index + 1).padStart(2, '0')}
                {image.caption ? ` / ${localize(image.caption, i18n.language)}` : ' / MycoDx R&D'}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="editorial-empty">
          <p>{t('gallery.empty')}</p>
        </div>
      )}
    </div>
  )
}
