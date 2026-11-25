import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import productData from '../content/products.json'
import { localize, type ProductContent } from '../content/types'
import NotFound from './NotFound'
import ProductPhoto from '../components/products/ProductPhoto'

const productItems = productData as ProductContent[]

export default function ProductDetail() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()

  const product = productItems.find((item) => item.id === id)
  const detailFeatures = product?.detailFeatures ?? product?.specs?.map((description) => ({
    title: undefined,
    description,
  }))

  if (!product) {
    return <NotFound />
  }

  return (
    <div className="editorial-page product-detail-page">
      <header className="editorial-page__header product-detail__header">
        <p>{t('product.kicker')}</p>
        <div className="product-detail__title">
          <h1>{localize(product.title, i18n.language)}</h1>
          {localize(product.title, i18n.language) !== product.title.en && (
            <p className="product-detail__english-name" lang="en">{product.title.en}</p>
          )}
        </div>
        <span>{localize(product.detailSummary ?? product.summary, i18n.language)}</span>
      </header>

      <div className="product-detail__body">
        {product.image ? (
          <ProductPhoto
            key={product.id}
            src={product.image}
            preview={product.imagePreview}
            title={localize(product.title, i18n.language)}
            category={product.category}
          />
        ) : (
          <div className="product-detail__visual">
            {product.category && <span className="product-detail__category">{product.category}</span>}
          </div>
        )}

        <div className="product-detail__content">
          {product.family && (
            <div className="product-detail__meta">
              <span className="product-detail__family">
                {localize(product.family, i18n.language)}
              </span>
            </div>
          )}

          <div className="product-detail__section">
            <h2>{t('product.specsTitle')}</h2>
            {detailFeatures && detailFeatures.length > 0 ? (
              <ul className="product-detail__specs">
                {detailFeatures.map((feature) => (
                  <li key={localize(feature.title ?? feature.description, i18n.language)}>
                    {feature.title && <h3>{localize(feature.title, i18n.language)}</h3>}
                    <p>{localize(feature.description, i18n.language)}</p>
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
