import { useEffect, useRef, useState } from 'react'

// Live "what does this card cost right now, and why" chip. Replaces the old
// static tier badge — under the computed-tier model there's no tier to pick,
// so this is the one place a sender sees the consequence of what they've
// added, with a tap-to-expand breakdown instead of a padlock anywhere else.
function TierMeter({ tier, cost, reasons = [], compact = false }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const prevTierRef = useRef(tier)
  const [bump, setBump] = useState(false)

  useEffect(() => {
    if (prevTierRef.current !== tier) {
      prevTierRef.current = tier
      setBump(true)
      const t = setTimeout(() => setBump(false), 500)
      return () => clearTimeout(t)
    }
  }, [tier])

  useEffect(() => {
    if (!open) return
    const handleClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const handleKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const label = tier === 'classic' ? 'Classic' : tier === 'premium' ? 'Premium' : 'Elite'
  const costLabel = cost > 0 ? `${cost} CC` : 'Free'

  return (
    <div className={`cs-tier-meter-wrap${compact ? ' compact' : ''}`} ref={wrapRef}>
      <button
        type="button"
        className={`cs-tier-meter cs-tier-meter-${tier}${bump ? ' bump' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {tier === 'elite' && <span className="cs-tier-meter-star">★</span>}
        <span className="cs-tier-meter-label">{label}</span>
        <span className="cs-tier-meter-dot">·</span>
        <span className="cs-tier-meter-cost">{costLabel}</span>
      </button>
      {open && (
        <div className="cs-tier-meter-popover" role="dialog">
          {reasons.length === 0 ? (
            <p className="cs-tier-meter-empty">Nothing on this card raises its cost yet.</p>
          ) : (
            <>
              <p className="cs-tier-meter-popover-title">What's making this {label.toLowerCase()}</p>
              <ul className="cs-tier-meter-reasons">
                {reasons.map((r) => (
                  <li key={r.id} className={`cs-tier-meter-reason cs-tier-meter-reason-${r.tier}`}>
                    <span>{r.label}</span>
                    <span className="cs-tier-meter-reason-tag">{r.tier === 'elite' ? 'Elite' : 'Premium'}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default TierMeter
