import { forwardRef } from 'react'

const SEAL_ICONS = {
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
}

function buildBackground(bg = {}) {
  if (bg.type === 'image' && bg.imageUrl) {
    return { backgroundImage: `url(${bg.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  const colors = Array.isArray(bg.colors) && bg.colors.length ? bg.colors : ['#0d1b22', '#163543', '#091116']
  if (bg.type === 'gradient' || colors.length > 1) {
    const angle = typeof bg.angle === 'number' ? bg.angle : 145
    return { backgroundImage: `linear-gradient(${angle}deg, ${colors.join(', ')})` }
  }
  return { backgroundColor: colors[0] }
}

const TemplatePreviewSnapshot = forwardRef(function TemplatePreviewSnapshot({ cardObject, recipientName = '' }, ref) {
  const closed = cardObject?.closedState || {}
  const envelope = closed.envelope || {}
  const content = cardObject?.content || {}
  const theme = cardObject?.theme || {}
  const cardStyle = cardObject?.cardStyle || {}

  const heading = closed.headingText || content.heading || 'A moment for you'
  const bodyText = closed.bodyText || 'Tap to open your card'
  const buttonText = closed.button?.text || 'Open'

  const openHeading = content.heading || heading
  const openBody = content.body || 'A beautiful moment is waiting inside this card.'

  const sealIconKey = envelope.sealIcon || 'monogram'
  const monogramLetter = (recipientName || 'C').charAt(0).toUpperCase()
  const sealContent = sealIconKey === 'monogram'
    ? <span className="envelope-seal-monogram">{monogramLetter}</span>
    : SEAL_ICONS[sealIconKey] || SEAL_ICONS.wax

  const bgStyle = buildBackground(cardObject?.background)

  return (
    <div
      ref={ref}
      className="template-preview-snapshot"
      style={{
        position: 'fixed',
        left: '-99999px',
        top: 0,
        width: '1600px',
        height: '900px',
        display: 'flex',
        gap: '48px',
        padding: '48px',
        background: 'radial-gradient(ellipse at top, #0d1b22 0%, #04080b 70%)',
        fontFamily: theme.fontBody || 'Manrope, sans-serif',
      }}
    >
      {/* Envelope side */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
        }}
      >
        {recipientName && (
          <p style={{ fontFamily: 'Great Vibes, cursive', fontSize: '38px', color: 'rgba(255,255,255,0.78)', margin: 0 }}>
            For {recipientName},
          </p>
        )}
        <div
          className={`envelope-body paper-${envelope.paperTexture || 'smooth'}`}
          style={{
            position: 'relative',
            width: '560px',
            height: '360px',
            borderRadius: '14px',
            background: envelope.bodyColor || '#1a1f2c',
            border: `2px solid ${closed.borderColor || 'rgba(126, 247, 255, 0.25)'}`,
            boxShadow: '0 40px 80px rgba(0,0,0,0.55), inset 0 0 60px rgba(0,0,0,0.35)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: '14px',
              borderRadius: '10px',
              background: closed.backgroundColor || '#0e1218',
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: '14px',
            }}
          >
            <p style={{
              margin: 0,
              color: closed.headingColor || '#e8f1f4',
              fontFamily: closed.headingFont || theme.fontHeading || 'Cinzel, serif',
              fontSize: '36px',
              fontWeight: 700,
              textAlign: 'center',
            }}>
              {heading}
            </p>
            <p style={{ margin: 0, color: closed.textColor || 'rgba(220,242,247,0.75)', fontSize: '18px', textAlign: 'center' }}>
              {bodyText}
            </p>
          </div>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '55%',
              background: `linear-gradient(160deg, ${envelope.flapColor || '#242a38'}, ${envelope.bodyColor || '#1a1f2c'})`,
              clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '48%',
              transform: 'translate(-50%, -50%)',
              width: '90px',
              height: '90px',
              borderRadius: '50%',
              background: `radial-gradient(circle at 35% 30%, ${envelope.sealColor || '#b03030'}, #5a1010)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f9e6c0',
              fontFamily: 'Cinzel, serif',
              fontSize: '40px',
              fontWeight: 700,
              boxShadow: '0 6px 16px rgba(0,0,0,0.5), inset 0 2px 6px rgba(255,255,255,0.25)',
              zIndex: 5,
            }}
          >
            {sealContent}
          </div>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px', letterSpacing: '0.2em', textTransform: 'uppercase', margin: 0 }}>
          Sealed
        </p>
      </div>

      {/* Open letter side */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '560px',
            height: '720px',
            borderRadius: cardStyle.borderRadius || '28px',
            padding: '56px 44px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '24px',
            border: `1px solid ${cardStyle.borderColor || 'rgba(126, 247, 255, 0.25)'}`,
            boxShadow: '0 40px 100px rgba(0,0,0,0.6)',
            ...bgStyle,
          }}
        >
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            background: 'rgba(7,14,18,0.35)',
            pointerEvents: 'none',
          }} />
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <p style={{
              margin: 0,
              fontFamily: theme.fontHeading || 'Cinzel, serif',
              fontSize: '44px',
              fontWeight: 700,
              color: theme.headingColor || '#f4fdff',
              textAlign: 'center',
              lineHeight: 1.2,
            }}>
              {openHeading}
            </p>
            <p style={{
              margin: 0,
              fontSize: '20px',
              lineHeight: 1.55,
              color: theme.textColor || 'rgba(232, 241, 244, 0.85)',
              textAlign: 'center',
            }}>
              {openBody}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
              <div style={{
                padding: '16px 44px',
                borderRadius: '999px',
                background: 'rgba(126, 247, 255, 0.18)',
                border: '1px solid rgba(126, 247, 255, 0.4)',
                color: '#f4fdff',
                fontSize: '18px',
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}>
                {buttonText}
              </div>
            </div>
          </div>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px', letterSpacing: '0.2em', textTransform: 'uppercase', margin: 0 }}>
          Opened
        </p>
      </div>
    </div>
  )
})

export default TemplatePreviewSnapshot
