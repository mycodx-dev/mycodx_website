import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import productData from '../content/products.json'
import { localize, type ProductContent } from '../content/types'
import NotFound from './NotFound'

const productItems = productData as ProductContent[]

export default function ProductDetail() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()

  const product = productItems.find((item) => item.id === id)
  const detailFeatures = product?.detailFeatures ?? product?.specs

  if (!product) {
    return <NotFound />
  }

  return (
    <div className="editorial-page product-detail-page">
      <header className="editorial-page__header product-detail__header">
        <p>{t('product.kicker')}</p>
        <h1>{localize(product.title, i18n.language)}</h1>
        <span>{localize(product.detailSummary ?? product.summary, i18n.language)}</span>
      </header>

      <div className="product-detail__body">
        <div className="product-detail__visual">
          {product.image && (
            <img src={product.image} alt={localize(product.title, i18n.language)} />
          )}
          {product.category && <span className="product-detail__category">{product.category}</span>}
        </div>

        <div className="product-detail__content">
          <div className="product-detail__meta">
            {product.family && (
              <span className="product-detail__family">
                {localize(product.family, i18n.language)}
              </span>
            )}
            {product.status && <em>{localize(product.status, i18n.language)}</em>}
          </div>

          <div className="product-detail__section">
            <h2>{t('product.specsTitle')}</h2>
            {detailFeatures && detailFeatures.length > 0 ? (
              <ul className="product-detail__specs">
                {detailFeatures.map((feature) => (
                  <li key={localize(feature, i18n.language)}>
                    {localize(feature, i18n.language)}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {product.tags && product.tags.length > 0 && (
            <div className="product-detail__tags editorial-card__tags">
              {product.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          )}

          <Link to="/product" className="product-detail__back">
            {t('product.backToList')}
          </Link>
        </div>
      </div>
    </div>
  )
}
