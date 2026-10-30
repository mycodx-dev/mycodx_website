import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'

interface Props {
  title: string
  description: string
  confirmLabel: string
  onClose: () => void
}

export default function ApplicationSuccessDialog({ title, description, confirmLabel, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

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
    <dialog ref={dialogRef} className="careers-success-dialog" aria-labelledby="careers-success-title" aria-describedby="careers-success-description" onClose={() => { if (!dialogRef.current?.open) onClose() }}>
      <div className="careers-success-dialog__panel">
        <div className="careers-success-dialog__icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 id="careers-success-title">{title}</h2>
        <p id="careers-success-description">{description}</p>
        <Link to="/careers" className="careers-success-dialog__confirm">{confirmLabel}</Link>
      </div>
    </dialog>,
    document.body,
  )
}
