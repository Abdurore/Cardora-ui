import { createPortal } from 'react-dom'

const ICON = {
  danger:  '⚠',
  warning: '⚠',
  default: '?',
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  variant      = 'default',
  onConfirm,
  onCancel,
}) {
  return createPortal(
    <div className="app-confirm-overlay" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="app-confirm-modal" onClick={e => e.stopPropagation()}>
        <div className={`app-confirm-icon-wrap app-confirm-icon-wrap--${variant}`}>
          <span className="app-confirm-icon">{ICON[variant] || '?'}</span>
        </div>
        <h3 className="app-confirm-title">{title}</h3>
        {message && <p className="app-confirm-message">{message}</p>}
        <div className="app-confirm-actions">
          <button type="button" className="ghost app-confirm-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`app-confirm-ok app-confirm-ok--${variant}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
