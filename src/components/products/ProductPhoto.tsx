import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

interface ProductPhotoProps {
  src: string
  preview?: string
  title: string
  category?: string
}

function PhotoDialog({ src, title, onClose }: ProductPhotoProps & { onClose: () => void }) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const backdropPress = useRef(false)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    const previousOverflow = document.body.style.overflow
    dialog?.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog?.close()
      document.body.style.overflow = previousOverflow
    }
  }, [])

  return createPortal(
    <dialog
      ref={dialogRef}
      className="product-photo-dialog"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key === 'Tab') {
          event.preventDefault()
          dialogRef.current?.querySelector('button')?.focus()
        }
      }}
      onClose={() => { if (!dialogRef.current?.open) onClose() }}
      onPointerDown={(event) => { backdropPress.current = event.target === event.currentTarget }}
      onClick={(event) => {
        if (backdropPress.current && event.target === event.currentTarget) dialogRef.current?.close()
      }}
    >
      <div className="product-photo-dialog__panel">
        <header className="product-photo-dialog__header">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="product-photo-dialog__close"
            onClick={() => dialogRef.current?.close()}
            aria-label={t('product.closeImage')}
            autoFocus
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <img src={src} alt={title} className="product-photo-dialog__image" />
      </div>
    </dialog>,
    document.body,
  )
}

export default function ProductPhoto({ src, preview, title, category }: ProductPhotoProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="product-detail__visual">
      <button
        type="button"
        className="product-detail__photo"
        onClick={() => setExpanded(true)}
        aria-label={t('product.enlargeImage', { product: title })}
        aria-haspopup="dialog"
      >
        {category && <span className="product-detail__category">{category}</span>}
        <img src={preview ?? src} alt={title} decoding="async" />
        <span className="product-detail__zoom" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t('product.viewLarger')}
        </span>
      </button>
      {expanded && <PhotoDialog src={src} title={title} onClose={() => setExpanded(false)} />}
    </div>
  )
}
