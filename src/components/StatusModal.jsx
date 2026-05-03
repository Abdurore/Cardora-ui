import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function StatusModal({
  type        = 'success',
  title,
  message,
  onClose,
  autoDismiss = type === 'success' ? 3000 : 5000,
}) {
  useEffect(() => {
    if (!autoDismiss) return
    const t = setTimeout(onClose, autoDismiss)
    return () => clearTimeout(t)
  }, [autoDismiss, onClose])

  return createPortal(
    <div className={`app-status-wrap app-status-wrap--${type}`} onClick={onClose}>
      <div className="app-status-card" onClick={e => e.stopPropagation()}>
        <span className={`app-status-icon-sm app-status-icon-sm--${type}`}>
          {type === 'success' ? '✓' : '✕'}
        </span>
        <div className="app-status-body">
          {title   && <strong className="app-status-title">{title}</strong>}
          {message && <span   className="app-status-msg">{message}</span>}
        </div>
        <button type="button" className="app-status-dismiss" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
    </div>,
    document.body,
  )
}
