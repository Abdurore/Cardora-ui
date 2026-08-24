import { useEffect, useState } from 'react'

// 6.8: "Prompt install after first successful send." Rendered only from a
// send-success screen (CardStudio/QuickCreate), so it only ever has the
// chance to appear once a card has actually been sent. The localStorage
// flag makes that "once, ever" -- even if the visitor never interacts with
// it, it won't show again on a later send.
const STORAGE_KEY = 'cardora-install-prompt-shown'

function alreadyShown() {
  try {
    return !!localStorage.getItem(STORAGE_KEY)
  } catch {
    return false
  }
}

function InstallPrompt({ canInstall, promptInstall }) {
  // Read once, at mount, before this instance's own effect below ever
  // writes the flag -- otherwise visibility would flip back off the moment
  // it marks itself shown (canInstall stays true, but "already shown" would
  // suddenly read true too).
  const [wasAlreadyShown] = useState(() => alreadyShown())
  const [dismissed, setDismissed] = useState(false)
  const [outcome, setOutcome] = useState(null) // null | 'accepted'
  // Derived during render, not via setState-in-effect: visibility is a pure
  // function of the canInstall prop and local state.
  const visible = !!canInstall && !wasAlreadyShown && !dismissed

  // The only actual side effect here is persisting "shown" for future
  // mounts -- it never calls a state setter, so it can't trigger the
  // cascading-render pattern the set-state-in-effect rule warns about.
  useEffect(() => {
    if (!visible) return
    try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* ignore */ }
  }, [visible])

  if (!visible) return null

  const handleInstall = async () => {
    const choice = await promptInstall?.()
    if (choice?.outcome === 'accepted') {
      setOutcome('accepted')
    } else {
      setDismissed(true)
    }
  }

  return (
    <div className="cs-install-prompt" role="status">
      <span className="cs-install-prompt-icon">⬇</span>
      <div className="cs-install-prompt-text">
        <p className="cs-install-prompt-title">
          {outcome === 'accepted' ? 'Installing Cardora…' : 'Add Cardora to your home screen'}
        </p>
        {outcome !== 'accepted' && (
          <p className="cs-install-prompt-sub">Open it like an app — one tap, no browser bar.</p>
        )}
      </div>
      {outcome !== 'accepted' && (
        <div className="cs-install-prompt-actions">
          <button type="button" className="cs-install-prompt-btn" onClick={handleInstall}>Install</button>
          <button type="button" className="cs-install-prompt-dismiss" onClick={() => setDismissed(true)}>Not now</button>
        </div>
      )}
    </div>
  )
}

export default InstallPrompt
