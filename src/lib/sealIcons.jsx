// Single source of truth for envelope seal icons — shared by Envelope.jsx
// (recipient view), CardStudio's desktop + mobile live previews, and every
// seal-icon picker (desktop dropdown, mobile inline dropdown). Previously
// each of those five call sites hand-copied the same SVG switch, and they
// had already drifted: the mobile live preview and mobile picker only knew
// about 3 of the 6 icons, so picking "Moon"/"Flower" on desktop silently
// fell back to a plain circle on mobile. Add a new seal here and every
// consumer gets it for free.

export const SEAL_ICON_OPTIONS = [
  { label: 'Monogram', value: 'monogram' },
  { label: 'Heart', value: 'heart' },
  { label: 'Star', value: 'star' },
  { label: 'Moon', value: 'moon' },
  { label: 'Flower', value: 'flower' },
  { label: 'Wax', value: 'wax' },
]

export const SEAL_ICONS = {
  heart: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s-7.5-4.8-7.5-11a4.5 4.5 0 0 1 8.25-2.5A4.5 4.5 0 0 1 21 10c0 6.2-9 11-9 11z" fill="currentColor" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2l2.9 6.6 7.1.7-5.4 4.9 1.6 7L12 17.8 5.8 21.2l1.6-7L2 9.3l7.1-.7z" fill="currentColor" />
    </svg>
  ),
  wax: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="currentColor" />
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 1 0 11 11z" fill="currentColor" />
    </svg>
  ),
  flower: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <g fill="currentColor">
        <circle cx="12" cy="12" r="2.6" />
        <ellipse cx="12" cy="5.8" rx="2.6" ry="4" />
        <ellipse cx="12" cy="18.2" rx="2.6" ry="4" />
        <ellipse cx="5.8" cy="12" rx="4" ry="2.6" />
        <ellipse cx="18.2" cy="12" rx="4" ry="2.6" />
      </g>
    </svg>
  ),
}

/**
 * Renders the seal's inner content for a given icon key. Monogram needs the
 * recipient's initial (or a heart fallback), everything else is a static SVG.
 */
export function renderSealContent(sealIconKey, monogramLetter) {
  if ((sealIconKey || 'monogram') === 'monogram') {
    return <span className="envelope-seal-monogram">{monogramLetter || '♥'}</span>
  }
  return SEAL_ICONS[sealIconKey] || SEAL_ICONS.wax
}
