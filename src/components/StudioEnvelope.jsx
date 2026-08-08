import { useId } from 'react'
import Dropdown from './Dropdown.jsx'
import InlineColorPicker from './InlineColorPicker.jsx'
import { SEAL_ICON_OPTIONS, renderSealContent, deriveRecipientName } from '../lib/sealIcons.jsx'

// The Studio's editable envelope/letter-peek surface — previously hand-copied
// between the desktop canvas and the mobile live preview, and had already
// drifted (desktop's inline floating toolbar has no mobile counterpart here
// by design; mobile edits via CardStudio's own bottom edit-zone instead).
// This component covers only the shared part: the envelope visual itself
// (body, hitbox, flap, seal) plus the optional desktop inline toolbar.
function StudioEnvelope({
  envelope,
  borderColor,
  recipientCaption,
  recipientEmail,
  width = 240,
  activeEditEl,
  onSelect,
  onDismiss,
  showToolbar = false,
  colorPresets = [],
  onUpdate,
  containerStyle,
}) {
  const glowFilterId = useId()
  const env = envelope || {}
  const paperTextureClass = `paper-${env.paperTexture || 'smooth'}`
  const sealIconKey = env.sealIcon || 'monogram'
  const recipientName = deriveRecipientName(recipientCaption, recipientEmail)
  const monogramLetter = recipientName ? recipientName.charAt(0).toUpperCase() : '♥'
  const sealContent = (
    <span style={{ width: '24px', height: '24px', display: 'inline-flex', color: 'inherit' }}>
      {renderSealContent(sealIconKey, monogramLetter)}
    </span>
  )

  return (
    <div className="cs-preview-envelope-container" onClick={onDismiss} style={containerStyle}>
      <div
        className={`envelope-body ${paperTextureClass} cs-editable-envelope`}
        style={{
          '--envelope-body': env.bodyColor || '#1a1f2c',
          '--envelope-flap': env.flapColor || '#242a38',
          '--envelope-border': borderColor || 'rgba(126, 247, 255, 0.25)',
          width: `${width}px`,
          position: 'relative',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <div className="envelope-inside-glow" />

        {/* Body hitbox — covers full envelope at z:1 */}
        <div
          className={`envelope-body-hitbox${activeEditEl?.type === 'envelopeBody' ? ' cs-edit-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); onSelect({ type: 'envelopeBody', index: 0 }) }}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}
        />

        {/* Visual flap — no pointer events, purely decorative */}
        <div className="envelope-flap" style={{ pointerEvents: 'none' }} />

        {/* SVG glowing triangle outline — only when flap is active */}
        {activeEditEl?.type === 'envelopeFlap' && (
          <svg
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '62%', zIndex: 5, pointerEvents: 'none', overflow: 'visible' }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <filter id={glowFilterId} x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <polygon
              points="0,0 100,0 50,100"
              fill="none"
              stroke="rgba(126,247,255,0.45)"
              strokeWidth="2"
              filter={`url(#${glowFilterId})`}
            />
          </svg>
        )}

        {/* Transparent flap hit zone at z:3 — above flap visual but below seal */}
        <div
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '62%', zIndex: 3, cursor: 'pointer', clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }}
          onClick={(e) => { e.stopPropagation(); onSelect({ type: 'envelopeFlap', index: 0 }) }}
        />

        {/* Seal — z:10 so it's always on top and clickable */}
        <span
          className={`envelope-seal${activeEditEl?.type === 'envelopeSeal' ? ' cs-edit-active' : ''}`}
          style={{ '--seal-color': env.sealColor || '#b03030', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto' }}
          onClick={(e) => { e.stopPropagation(); onSelect({ type: 'envelopeSeal', index: 0 }) }}
        >
          {sealContent}
        </span>

        {/* Floating toolbar for desktop — anchored inside envelope body */}
        {showToolbar && activeEditEl && (activeEditEl.type === 'envelopeBody' || activeEditEl.type === 'envelopeFlap' || activeEditEl.type === 'envelopeSeal') && (
          <div className="cs-edit-toolbar cs-edit-toolbar-envelope-inner" onClick={e => e.stopPropagation()}>
            {activeEditEl.type === 'envelopeBody' && (
              <>
                <span className="cs-edit-toolbar-label">Body</span>
                <InlineColorPicker value={env.bodyColor || '#1a1f2c'} onChange={e => onUpdate('closedState.envelope.bodyColor', e.target.value)} presets={colorPresets} label="Color" />
                <Dropdown
                  usePortal
                  className="cs-toolbar-dropdown"
                  value={env.paperTexture || 'smooth'}
                  onChange={v => onUpdate('closedState.envelope.paperTexture', v)}
                  options={[
                    { label: 'Smooth', value: 'smooth' },
                    { label: 'Linen', value: 'linen' },
                    { label: 'Parchment', value: 'parchment' },
                  ]}
                />
              </>
            )}
            {activeEditEl.type === 'envelopeFlap' && (
              <>
                <span className="cs-edit-toolbar-label">Flap</span>
                <InlineColorPicker value={env.flapColor || '#242a38'} onChange={e => onUpdate('closedState.envelope.flapColor', e.target.value)} presets={colorPresets} label="Color" />
              </>
            )}
            {activeEditEl.type === 'envelopeSeal' && (
              <>
                <span className="cs-edit-toolbar-label">Seal</span>
                <InlineColorPicker value={env.sealColor || '#b03030'} onChange={e => onUpdate('closedState.envelope.sealColor', e.target.value)} presets={colorPresets} label="Color" />
                <Dropdown
                  usePortal
                  className="cs-toolbar-dropdown"
                  value={env.sealIcon || 'monogram'}
                  onChange={v => onUpdate('closedState.envelope.sealIcon', v)}
                  options={SEAL_ICON_OPTIONS}
                />
              </>
            )}
            <button type="button" className="cs-edit-toolbar-close" onClick={onDismiss}>×</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default StudioEnvelope
