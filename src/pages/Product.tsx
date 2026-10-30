import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import productData from '../content/products.json'
import { localize, sortByOrder, type ProductContent } from '../content/types'

const productItems = productData as ProductContent[]

export default function Product() {
  const { t, i18n } = useTranslation()
  const visibleProducts = sortByOrder(
    productItems.filter((product) => product.visible !== false),
  )

  return (
    <div className="editorial-page product-page">
      <header className="editorial-page__header">
        <p>{t('product.kicker')}</p>
        <h1>{t('product.title')}</h1>
        <span>{t('product.description')}</span>
      </header>

      {visibleProducts.length > 0 ? (
        <section className="product-platform" aria-labelledby="product-platform-title">
          <div className="product-platform__overview">
            <span>{t('product.bundleBadge')}</span>
            <div>
              <h2 id="product-platform-title">{t('product.bundleName')}</h2>
              <p>{t('product.bundleDescription')}</p>
            </div>
          </div>

          <ol className="product-platform__sequence" aria-hidden="true">
            {visibleProducts.map((product) => (
              <li key={`sequence-${product.id}`} />
            ))}
          </ol>

          <div className="editorial-list editorial-list--three product-list product-list--connected">
            {visibleProducts.map((product) => (
              <Link
                to={`/product/${product.id}`}
                className="editorial-card product-card product-card-link"
                key={product.id}
              >
                {product.image && (
                  <img src={product.image} alt={localize(product.title, i18n.language)} />
                )}
                <div className="product-card__intro">
                  {product.category && (
                    <div className="product-card__meta">
                      <span>{product.category}</span>
                    </div>
                  )}
                  <h3>{localize(product.title, i18n.language)}</h3>
                  <p>{localize(product.listSummary ?? product.summary, i18n.language)}</p>
                </div>
                {product.listFeatures && product.listFeatures.length > 0 && (
                  <ul className="product-card__specs">
                    {product.listFeatures.map((feature) => (
                      <li key={localize(feature, i18n.language)}>
                        {localize(feature, i18n.language)}
                      </li>
                    ))}
                  </ul>
                )}
                {product.tags && product.tags.length > 0 && (
                  <div className="editorial-card__tags">
                    {product.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="product-placeholder" aria-labelledby="product-status-title">
          <span className="product-placeholder__index">01 / PRODUCT</span>
          <div className="product-placeholder__copy">
            <p>{t('product.status')}</p>
            <div>
              <h2 id="product-status-title">{t('product.placeholderTitle')}</h2>
              <p>{t('product.placeholderDescription')}</p>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
