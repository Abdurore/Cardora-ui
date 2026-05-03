import { useState } from 'react'
import { createPortal } from 'react-dom'
import { reportUser, reportCard, reportTemplate } from '../lib/api.js'

const REASONS = [
  'Inappropriate content',
  'Spam or misleading',
  'Harassment or abuse',
  'Impersonation',
  'Offensive language',
  'Other',
]

const LABELS = {
  user: 'user',
  card: 'card',
  template: 'template',
}

export default function ReportModal({ type, targetId, targetName, onClose }) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [phase, setPhase] = useState('form') // form | submitting | done | error
  const [errMsg, setErrMsg] = useState('')

  const handleSubmit = async () => {
    if (!reason) return
    setPhase('submitting')
    try {
      if (type === 'user') await reportUser(targetId, reason, details)
      else if (type === 'card') await reportCard(targetId, reason, details)
      else await reportTemplate(targetId, reason, details)
      setPhase('done')
    } catch (err) {
      setErrMsg(err.message || 'Report could not be submitted.')
      setPhase('error')
    }
  }

  return createPortal(
    <div className="report-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="report-modal" onClick={e => e.stopPropagation()}>
        <button className="report-modal-close" type="button" onClick={onClose} aria-label="Close">✕</button>

        {phase === 'done' ? (
          <div className="report-modal-done">
            <div className="report-modal-done-icon">✓</div>
            <h3>Report submitted</h3>
            <p>Thanks for helping keep Cardora safe. Our team will review this {LABELS[type] || 'item'}.</p>
            <button className="primary" type="button" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <h3 className="report-modal-title">Report {LABELS[type] || 'item'}{targetName ? `: ${targetName}` : ''}</h3>
            <p className="report-modal-sub">Select a reason so our moderation team can investigate quickly.</p>

            <div className="report-modal-reasons">
              {REASONS.map(r => (
                <button
                  key={r}
                  type="button"
                  className={`report-reason-chip ${reason === r ? 'active' : ''}`}
                  onClick={() => setReason(r)}
                >
                  {r}
                </button>
              ))}
            </div>

            <textarea
              className="report-modal-details"
              placeholder="Optional — add more context (max 300 chars)"
              maxLength={300}
              value={details}
              onChange={e => setDetails(e.target.value)}
              rows={3}
            />

            {phase === 'error' && <p className="report-modal-error">{errMsg}</p>}

            <div className="report-modal-actions">
              <button className="ghost" type="button" onClick={onClose}>Cancel</button>
              <button
                className="primary report-modal-submit"
                type="button"
                onClick={handleSubmit}
                disabled={!reason || phase === 'submitting'}
              >
                {phase === 'submitting' ? 'Submitting…' : 'Submit Report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
