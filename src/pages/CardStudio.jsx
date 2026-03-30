import { useEffect, useMemo, useState, useRef } from 'react'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import {
  HiOutlineEnvelope, HiOutlinePaintBrush, HiOutlinePhoto,
  HiOutlineSparkles, HiOutlineChatBubbleLeft, HiOutlineLockClosed,
  HiOutlineDocumentText, HiOutlineMusicalNote, HiOutlineEye,
  HiOutlineGift
} from 'react-icons/hi2'
import { IoColorPaletteOutline } from 'react-icons/io5'
import logo from '../assets/icons/logo.png'
import { defaultCardObject, resolveTemplateCardObject, musicPresets, fontOptions } from '../data/cardDefaults.js'
import CardPreviewModal from '../components/CardPreviewModal.jsx'
import { GiftIcon } from '../components/GiftCard.jsx'

const steps = ['closed', 'card', 'questions', 'preview']

const tools = [
  { id: 'closedState', icon: HiOutlineEnvelope, label: 'Closed State', hint: 'First impression & button' },
  { id: 'content', icon: HiOutlineDocumentText, label: 'Content', hint: 'Heading, body, extended' },
  { id: 'media', icon: HiOutlinePhoto, label: 'Media', hint: 'Images & captions' },
  { id: 'background', icon: HiOutlinePaintBrush, label: 'Background', hint: 'Colors, gradients, music' },
  { id: 'theme', icon: IoColorPaletteOutline, label: 'Theme', hint: 'Fonts & palette' },
  { id: 'cardStyle', icon: HiOutlineSparkles, label: 'Card Style', hint: 'Border, scrollbar, text FX' },
  { id: 'animation', icon: HiOutlineSparkles, label: 'Animation', hint: 'Confetti & effects' },
  { id: 'gifts', icon: HiOutlineGift, label: 'Gifts', hint: 'End-of-card gift reveal' },
  { id: 'questions', icon: HiOutlineChatBubbleLeft, label: 'Questions', hint: 'Receiver interaction' },
  { id: 'interaction', icon: HiOutlineLockClosed, label: 'Interaction', hint: 'Lock & reveal' },
]

// Deep merge helper
function deepMerge(target, source) {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key])
    } else {
      result[key] = source[key]
    }
  }
  return result
}

function ColorInput({ value, onChange, label }) {
  return (
    <label className="cs-color-field">
      <span>{label}</span>
      <div className="cs-color-wrap">
        <input type="color" value={value} onChange={onChange} />
        <input
          type="text"
          value={value}
          onChange={onChange}
          className="cs-color-text"
          maxLength={7}
        />
      </div>
    </label>
  )
}

function CardStudio() {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser, inventory = [] } = useOutletContext() || {}
  const cardData = useMemo(() => location.state?.cardData || null, [location.state])

  const [cardObject, setCardObject] = useState(() => resolveTemplateCardObject(cardData))
  const [activeTool, setActiveTool] = useState('closedState')
  const [activeStep, setActiveStep] = useState('closed')
  const [showPreview, setShowPreview] = useState(false)
  const [savedState, setSavedState] = useState('Unsaved draft')
  const [showPublish, setShowPublish] = useState(false)
  const fileInputRef = useRef(null)

  const isArtist = currentUser?.role === 'Artist'

  const c = cardObject

  // Updater helpers
  const update = (path, value) => {
    setCardObject(prev => {
      const keys = path.split('.')
      const result = structuredClone(prev)
      let current = result
      for (let i = 0; i < keys.length - 1; i++) {
        if (current[keys[i]] == null || typeof current[keys[i]] !== 'object') {
          current[keys[i]] = {}
        }
        current = current[keys[i]]
      }
      current[keys[keys.length - 1]] = value
      return result
    })
  }

  const goToStep = (step) => {
    setActiveStep(step)
    if (step === 'closed') setActiveTool('closedState')
    if (step === 'card') setActiveTool('content')
    if (step === 'questions') setActiveTool('questions')
    if (step === 'preview') {
      setShowPreview(true)
    }
  }

  const enterPreview = () => {
    setShowPreview(true)
    setActiveStep('preview')
  }

  const handleSave = () => {
    try {
      localStorage.setItem('cardora:studioCard', JSON.stringify(cardObject))
      setSavedState('Draft saved just now')
    } catch {
      setSavedState('Save failed')
    }
  }

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const newImages = [...c.media.images, { url: reader.result, caption: '' }]
        update('media.images', newImages)
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const removeImage = (idx) => {
    update('media.images', c.media.images.filter((_, i) => i !== idx))
  }

  const updateImageCaption = (idx, caption) => {
    const imgs = [...c.media.images]
    imgs[idx] = { ...imgs[idx], caption }
    update('media.images', imgs)
  }

  const addQuestion = () => {
    const items = [...c.questions.items, { text: 'New question?' }]
    update('questions.items', items)
  }

  const removeQuestion = (idx) => {
    update('questions.items', c.questions.items.filter((_, i) => i !== idx))
  }

  const updateQuestion = (idx, text) => {
    const items = [...c.questions.items]
    items[idx] = { ...items[idx], text }
    update('questions.items', items)
  }

  const addConfettiColor = () => {
    const colors = [...c.animation.confettiColors, '#ffffff']
    update('animation.confettiColors', colors)
  }

  const removeConfettiColor = (idx) => {
    update('animation.confettiColors', c.animation.confettiColors.filter((_, i) => i !== idx))
  }

  const addBorderColor = () => {
    update('card.cardBorder.colors', [...c.card.cardBorder.colors, '#ffffff'])
  }

  const addBgColor = () => {
    update('background.colors', [...c.background.colors, '#111111'])
  }

  // Tool panels
  const renderPanel = () => {
    // CLOSED STATE
    if (activeTool === 'closedState') {
      return (
        <>
          <p className="cs-panel-eyebrow">Closed State</p>
          <h3>First impression & sealed look</h3>
          <ColorInput label="Background" value={c.closedState.backgroundColor} onChange={e => update('closedState.backgroundColor', e.target.value)} />
          <ColorInput label="Border" value={c.closedState.borderColor} onChange={e => update('closedState.borderColor', e.target.value)} />
          <ColorInput label="Text Color" value={c.closedState.textColor} onChange={e => update('closedState.textColor', e.target.value)} />
          <ColorInput label="Heading Color" value={c.closedState.headingColor} onChange={e => update('closedState.headingColor', e.target.value)} />
          <label className="cs-field">
            <span>Heading Font</span>
            <select value={c.closedState.headingFont} onChange={e => update('closedState.headingFont', e.target.value)}>
              {fontOptions.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <label className="cs-field">
            <span>Heading Text</span>
            <input value={c.closedState.headingText} onChange={e => update('closedState.headingText', e.target.value)} />
          </label>
          <label className="cs-field">
            <span>Body Text</span>
            <textarea rows={3} value={c.closedState.bodyText} onChange={e => update('closedState.bodyText', e.target.value)} />
          </label>
          <div className="cs-sub-section">
            <p className="cs-sub-label">Open Button</p>
            <label className="cs-field">
              <span>Button Text</span>
              <input value={c.closedState.button.text} onChange={e => update('closedState.button.text', e.target.value)} />
            </label>
            <ColorInput label="Button BG" value={c.closedState.button.backgroundColor} onChange={e => update('closedState.button.backgroundColor', e.target.value)} />
            <ColorInput label="Button Text" value={c.closedState.button.textColor} onChange={e => update('closedState.button.textColor', e.target.value)} />
            <ColorInput label="Button Border" value={c.closedState.button.borderColor} onChange={e => update('closedState.button.borderColor', e.target.value)} />
            <div className="cs-choice-row">
              {['rounded', 'pill', 'square', 'sharp'].map(shape => (
                <button
                  key={shape}
                  type="button"
                  className={`cs-chip ${c.closedState.button.shape === shape ? 'active' : ''}`}
                  onClick={() => update('closedState.button.shape', shape)}
                >
                  {shape}
                </button>
              ))}
            </div>
          </div>
        </>
      )
    }

    // CONTENT
    if (activeTool === 'content') {
      return (
        <>
          <p className="cs-panel-eyebrow">Content</p>
          <h3>Shape your card's message</h3>
          <label className="cs-field">
            <span>Heading</span>
            <input value={c.content.heading} onChange={e => update('content.heading', e.target.value)} />
          </label>
          <label className="cs-field">
            <span>Body</span>
            <textarea rows={4} value={c.content.body} onChange={e => update('content.body', e.target.value)} />
          </label>
          <label className="cs-field">
            <span>Extended Body</span>
            <textarea rows={4} value={c.content.extendedBody} onChange={e => update('content.extendedBody', e.target.value)} placeholder="Additional text shown after the main body..." />
          </label>
        </>
      )
    }

    // MEDIA
    if (activeTool === 'media') {
      return (
        <>
          <p className="cs-panel-eyebrow">Media</p>
          <h3>Add images to your card</h3>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
          <button type="button" className="cs-button" onClick={() => fileInputRef.current?.click()}>
            + Upload Image
          </button>
          {c.media.images.length === 0 && (
            <p className="cs-empty">No images added yet.</p>
          )}
          {c.media.images.map((img, i) => (
            <div key={i} className="cs-image-card">
              <img src={img.url} alt="" className="cs-image-thumb" />
              <label className="cs-field">
                <span>Caption</span>
                <input value={img.caption} onChange={e => updateImageCaption(i, e.target.value)} placeholder="Add a caption..." />
              </label>
              <button type="button" className="cs-remove-btn" onClick={() => removeImage(i)}>Remove</button>
            </div>
          ))}
        </>
      )
    }

    // BACKGROUND
    if (activeTool === 'background') {
      return (
        <>
          <p className="cs-panel-eyebrow">Background</p>
          <h3>Set the stage</h3>
          <div className="cs-choice-row">
            {['color', 'gradient', 'image', 'video', 'animated'].map(type => (
              <button
                key={type}
                type="button"
                className={`cs-chip ${c.background.type === type ? 'active' : ''}`}
                onClick={() => update('background.type', type)}
              >
                {type}
              </button>
            ))}
          </div>

          {(c.background.type === 'color' || c.background.type === 'gradient' || c.background.type === 'animated') && (
            <div className="cs-sub-section">
              <p className="cs-sub-label">Colors</p>
              {c.background.colors.map((color, i) => (
                <div key={i} className="cs-color-row">
                  <ColorInput label={`Color ${i + 1}`} value={color} onChange={e => {
                    const colors = [...c.background.colors]
                    colors[i] = e.target.value
                    update('background.colors', colors)
                  }} />
                  {c.background.colors.length > 1 && (
                    <button type="button" className="cs-inline-remove" onClick={() => {
                      update('background.colors', c.background.colors.filter((_, j) => j !== i))
                    }}>×</button>
                  )}
                </div>
              ))}
              {c.background.type !== 'color' && (
                <button type="button" className="cs-button small" onClick={addBgColor}>+ Add Color</button>
              )}
            </div>
          )}

          {(c.background.type === 'animated' || c.background.type === 'gradient') && (
            <label className="cs-field">
              <span>Animation Duration (s)</span>
              <input type="range" min="1" max="10" step="0.5" value={c.background.animationDuration} onChange={e => update('background.animationDuration', Number(e.target.value))} />
              <span className="cs-range-val">{c.background.animationDuration}s</span>
            </label>
          )}

          {c.background.type === 'image' && (
            <label className="cs-field">
              <span>Image URL</span>
              <input type="url" value={c.background.imageUrl} onChange={e => update('background.imageUrl', e.target.value)} placeholder="https://..." />
            </label>
          )}

          {c.background.type === 'video' && (
            <label className="cs-field">
              <span>Video URL</span>
              <input type="url" value={c.background.videoUrl} onChange={e => update('background.videoUrl', e.target.value)} placeholder="https://..." />
            </label>
          )}

          <div className="cs-sub-section">
            <p className="cs-sub-label"><HiOutlineMusicalNote style={{ verticalAlign: 'middle' }} /> Background Music</p>
            <label className="cs-field">
              <span>Music URL</span>
              <input type="url" value={c.background.music.url} onChange={e => update('background.music.url', e.target.value)} placeholder="paste audio URL or pick below" />
            </label>
            <div className="cs-preset-list">
              {musicPresets.map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  className={`cs-chip small ${c.background.music.url === preset.url ? 'active' : ''}`}
                  onClick={() => update('background.music.url', preset.url)}
                >
                  ♫ {preset.label}
                </button>
              ))}
            </div>
            <label className="cs-field">
              <span>Volume</span>
              <input type="range" min="0" max="1" step="0.05" value={c.background.music.volume} onChange={e => update('background.music.volume', Number(e.target.value))} />
              <span className="cs-range-val">{Math.round(c.background.music.volume * 100)}%</span>
            </label>
          </div>
        </>
      )
    }

    // THEME
    if (activeTool === 'theme') {
      return (
        <>
          <p className="cs-panel-eyebrow">Theme</p>
          <h3>Global look & feel</h3>
          <label className="cs-field">
            <span>Font Family</span>
            <select value={c.theme.fontFamily} onChange={e => update('theme.fontFamily', e.target.value)}>
              {fontOptions.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <ColorInput label="Accent Color" value={c.theme.accentColor} onChange={e => update('theme.accentColor', e.target.value)} />
          <ColorInput label="Text Color" value={c.theme.textColor} onChange={e => update('theme.textColor', e.target.value)} />
          <ColorInput label="Heading Color" value={c.theme.headingColor} onChange={e => update('theme.headingColor', e.target.value)} />
        </>
      )
    }

    // CARD STYLE
    if (activeTool === 'cardStyle') {
      return (
        <>
          <p className="cs-panel-eyebrow">Card Style</p>
          <h3>Surface, border & text animation</h3>
          <ColorInput label="Card Background" value={c.card.backgroundColor} onChange={e => update('card.backgroundColor', e.target.value)} />
          <ColorInput label="Card Text Color" value={c.card.textColor} onChange={e => update('card.textColor', e.target.value)} />
          <ColorInput label="Card Heading Color" value={c.card.headingColor} onChange={e => update('card.headingColor', e.target.value)} />
          <ColorInput label="Scrollbar Color" value={c.card.scrollbarColor} onChange={e => update('card.scrollbarColor', e.target.value)} />

          <div className="cs-sub-section">
            <p className="cs-sub-label">Card Border</p>
            <div className="cs-choice-row">
              {['solid', 'gradient', 'animated'].map(type => (
                <button
                  key={type}
                  type="button"
                  className={`cs-chip ${c.card.cardBorder.type === type ? 'active' : ''}`}
                  onClick={() => update('card.cardBorder.type', type)}
                >
                  {type}
                </button>
              ))}
            </div>
            {c.card.cardBorder.colors.map((color, i) => (
              <div key={i} className="cs-color-row">
                <ColorInput label={`Border ${i + 1}`} value={color} onChange={e => {
                  const colors = [...c.card.cardBorder.colors]
                  colors[i] = e.target.value
                  update('card.cardBorder.colors', colors)
                }} />
                {c.card.cardBorder.colors.length > 1 && (
                  <button type="button" className="cs-inline-remove" onClick={() => {
                    update('card.cardBorder.colors', c.card.cardBorder.colors.filter((_, j) => j !== i))
                  }}>×</button>
                )}
              </div>
            ))}
            {c.card.cardBorder.type !== 'solid' && (
              <button type="button" className="cs-button small" onClick={addBorderColor}>+ Add Color</button>
            )}
            <label className="cs-field">
              <span>Border Width</span>
              <input type="range" min="0" max="6" value={c.card.cardBorder.width} onChange={e => update('card.cardBorder.width', Number(e.target.value))} />
              <span className="cs-range-val">{c.card.cardBorder.width}px</span>
            </label>
            {c.card.cardBorder.type !== 'solid' && (
              <label className="cs-field">
                <span>Anim Duration</span>
                <input type="range" min="1" max="8" step="0.5" value={c.card.cardBorder.animationDuration} onChange={e => update('card.cardBorder.animationDuration', Number(e.target.value))} />
                <span className="cs-range-val">{c.card.cardBorder.animationDuration}s</span>
              </label>
            )}
          </div>

          <div className="cs-sub-section">
            <p className="cs-sub-label">Text Body Animation</p>
            <label className="cs-field">
              <span>Fade-In Duration</span>
              <select value={c.card.textBodyAnimation.fadeInDuration} onChange={e => update('card.textBodyAnimation.fadeInDuration', e.target.value)}>
                <option value="none">None</option>
                <option value="1">1s</option>
                <option value="2">2s</option>
                <option value="3">3s</option>
                <option value="4">4s</option>
              </select>
            </label>
            <label className="cs-field">
              <span>Typewriter Speed</span>
              <select value={c.card.textBodyAnimation.selfTypeSpeed} onChange={e => update('card.textBodyAnimation.selfTypeSpeed', e.target.value)}>
                <option value="none">None</option>
                <option value="1">Fast (1s)</option>
                <option value="2">Normal (2s)</option>
                <option value="3">Slow (3s)</option>
                <option value="5">Very Slow (5s)</option>
              </select>
            </label>
          </div>
        </>
      )
    }

    // ANIMATION
    if (activeTool === 'animation') {
      return (
        <>
          <p className="cs-panel-eyebrow">Animation</p>
          <h3>Open effect & background particles</h3>
          <div className="cs-sub-section">
            <p className="cs-sub-label">Open Effect</p>
            <div className="cs-choice-row">
              {['confetti', 'none'].map(eff => (
                <button
                  key={eff}
                  type="button"
                  className={`cs-chip ${c.animation.openEffect === eff ? 'active' : ''}`}
                  onClick={() => update('animation.openEffect', eff)}
                >
                  {eff === 'confetti' ? '🎉 Confetti' : 'None'}
                </button>
              ))}
            </div>
            {c.animation.openEffect === 'confetti' && (
              <>
                <p className="cs-sub-label">Confetti Colors</p>
                {c.animation.confettiColors.map((color, i) => (
                  <div key={i} className="cs-color-row">
                    <ColorInput label={`#${i + 1}`} value={color} onChange={e => {
                      const colors = [...c.animation.confettiColors]
                      colors[i] = e.target.value
                      update('animation.confettiColors', colors)
                    }} />
                    <button type="button" className="cs-inline-remove" onClick={() => removeConfettiColor(i)}>×</button>
                  </div>
                ))}
                <button type="button" className="cs-button small" onClick={addConfettiColor}>+ Add Color</button>
              </>
            )}
          </div>

          <div className="cs-sub-section">
            <p className="cs-sub-label">Background Effect</p>
            <div className="cs-choice-row">
              {['floating', 'snow', 'reverse', 'sparkle', 'none'].map(type => (
                <button
                  key={type}
                  type="button"
                  className={`cs-chip ${c.animation.backgroundEffect.type === type ? 'active' : ''}`}
                  onClick={() => update('animation.backgroundEffect.type', type)}
                >
                  {type}
                </button>
              ))}
            </div>
            {c.animation.backgroundEffect.type !== 'none' && (
              <label className="cs-field">
                <span>Emojis (comma separated)</span>
                <input
                  value={c.animation.backgroundEffect.emojis.join(', ')}
                  onChange={e => update('animation.backgroundEffect.emojis', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="❤️, ✨, 🌟"
                />
              </label>
            )}
          </div>
        </>
      )
    }

    // QUESTIONS
    if (activeTool === 'questions') {
      return (
        <>
          <p className="cs-panel-eyebrow">Questions</p>
          <h3>Receiver interaction flow</h3>
          {c.questions.items.map((q, i) => (
            <div key={i} className="cs-question-card">
              <label className="cs-field">
                <span>Question {i + 1}</span>
                <input value={q.text} onChange={e => updateQuestion(i, e.target.value)} />
              </label>
              <button type="button" className="cs-remove-btn" onClick={() => removeQuestion(i)}>Remove</button>
            </div>
          ))}
          <button type="button" className="cs-button" onClick={addQuestion}>+ Add Question</button>

          <div className="cs-sub-section">
            <p className="cs-sub-label">Button Style</p>
            <ColorInput label="Text Color" value={c.questions.button.textColor} onChange={e => update('questions.button.textColor', e.target.value)} />
            <ColorInput label="Border Color" value={c.questions.button.borderColor} onChange={e => update('questions.button.borderColor', e.target.value)} />
            <ColorInput label="Background" value={c.questions.button.backgroundColor} onChange={e => update('questions.button.backgroundColor', e.target.value)} />
          </div>

          <label className="cs-field">
            <span>Deny Behavior</span>
            <select value={c.questions.denyBehavior} onChange={e => update('questions.denyBehavior', e.target.value)}>
              <option value="none">Normal</option>
              <option value="switch">Dodge (button moves away)</option>
            </select>
          </label>
        </>
      )
    }

    // INTERACTION
    if (activeTool === 'interaction') {
      return (
        <>
          <p className="cs-panel-eyebrow">Interaction</p>
          <h3>Lock & reveal settings</h3>
          <div className="cs-sub-section">
            <p className="cs-sub-label">Lock</p>
            <div className="cs-choice-row">
              {['none', 'time', 'password'].map(type => (
                <button
                  key={type}
                  type="button"
                  className={`cs-chip ${c.interaction.lock.type === type ? 'active' : ''}`}
                  onClick={() => update('interaction.lock.type', type)}
                >
                  {type}
                </button>
              ))}
            </div>
            {c.interaction.lock.type !== 'none' && (
              <label className="cs-field">
                <span>{c.interaction.lock.type === 'time' ? 'Unlock Date/Time' : 'Password'}</span>
                <input
                  type={c.interaction.lock.type === 'time' ? 'datetime-local' : 'text'}
                  value={c.interaction.lock.value}
                  onChange={e => update('interaction.lock.value', e.target.value)}
                />
              </label>
            )}
          </div>

          <div className="cs-sub-section">
            <p className="cs-sub-label">Reveal Type</p>
            <div className="cs-choice-row">
              {['tap', 'password', 'zip'].map(type => (
                <button
                  key={type}
                  type="button"
                  className={`cs-chip ${c.interaction.reveal.type === type ? 'active' : ''}`}
                  onClick={() => update('interaction.reveal.type', type)}
                >
                  {type}
                </button>
              ))}
            </div>
            {c.interaction.reveal.type !== 'tap' && (
              <label className="cs-field">
                <span>Hint</span>
                <input value={c.interaction.reveal.hint} onChange={e => update('interaction.reveal.hint', e.target.value)} placeholder="Hint for the receiver..." />
              </label>
            )}
          </div>
        </>
      )
    }

    // GIFTS
    if (activeTool === 'gifts') {
      const selectedKey = c.giftEffect?.effectKey || 'none'
      return (
        <>
          <p className="cs-panel-eyebrow">Gifts</p>
          <h3>End-of-card gift reveal</h3>
          <p className="cs-field" style={{ fontSize: '0.78rem', opacity: 0.7, lineHeight: 1.55 }}>
            Attach a purchased gift animation that plays after the card reveal. The recipient will see a special moment before receiving it.
          </p>
          <div className="cs-sub-section">
            <p className="cs-sub-label">Select a Gift</p>
            <button
              type="button"
              className={`cs-gift-option ${selectedKey === 'none' ? 'active' : ''}`}
              onClick={() => {
                update('giftEffect.enabled', false)
                update('giftEffect.effectKey', 'none')
                update('giftEffect.giftTitle', '')
                update('giftEffect.giftAmount', '')
              }}
            >
              <span className="cs-gift-none-icon">✕</span>
              <span>No Gift</span>
            </button>
            {inventory.length > 0 ? (
              <div className="cs-gift-grid">
                {inventory.map((gift, idx) => (
                  <button
                    key={gift.id || idx}
                    type="button"
                    className={`cs-gift-option ${selectedKey === (gift.effectKey || gift.title) ? 'active' : ''}`}
                    onClick={() => {
                      update('giftEffect.enabled', true)
                      update('giftEffect.effectKey', gift.effectKey || gift.title)
                      update('giftEffect.giftTitle', gift.title)
                      update('giftEffect.giftAmount', gift.amount || '')
                    }}
                  >
                    <GiftIcon effectKey={gift.effectKey} size={36} />
                    <span>{gift.title}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="cs-field" style={{ fontSize: '0.78rem', opacity: 0.5 }}>
                No gifts in your inventory yet. Purchase gifts from the Store to attach them here.
              </p>
            )}
          </div>
          {c.giftEffect?.enabled && (
            <div className="cs-sub-section">
              <p className="cs-sub-label">Selected Gift</p>
              <div className="cs-gift-selected">
                <GiftIcon effectKey={c.giftEffect.effectKey} size={44} />
                <div>
                  <strong>{c.giftEffect.giftTitle}</strong>
                  {c.giftEffect.giftAmount && <span className="cs-gift-amount">{c.giftEffect.giftAmount}</span>}
                </div>
              </div>
            </div>
          )}
        </>
      )
    }

    return null
  }

  // Build preview card background
  const previewBg = useMemo(() => {
    if (c.background.type === 'color') return c.background.colors[0] || '#0a0a0a'
    if (c.background.type === 'gradient' || c.background.type === 'animated') {
      return `linear-gradient(135deg, ${c.background.colors.join(', ')})`
    }
    return '#0a0a0a'
  }, [c.background])

  // Button shape map
  const shapeMap = { rounded: '14px', pill: '999px', square: '6px', sharp: '0px' }
  const btnShape = shapeMap[c.closedState.button.shape] || '999px'

  // Card border for preview
  const cardBorderCss = useMemo(() => {
    if (c.card.cardBorder.type === 'solid') {
      return { border: `${c.card.cardBorder.width}px solid ${c.card.cardBorder.colors[0] || '#333'}` }
    }
    return {}
  }, [c.card.cardBorder])

  return (
    <div className="page-body cs-shell">
      {/* TOPBAR */}
      <div className="cs-topbar">
        <div className="cs-top-left">
          <button type="button" className="cs-nav-btn" onClick={() => navigate(-1)}>← Back</button>
          <div className="cs-status">{savedState}</div>
        </div>
        <div className="cs-progress">
          <div className="cs-wordmark">
            <img src={logo} alt="Cardora" className="cs-top-logo" />
            <span>Cardora Studio</span>
          </div>
          <div className="cs-steps">
            {steps.map((step, i) => {
              const ai = steps.indexOf(activeStep)
              const state = i === ai ? 'active' : i < ai ? 'done' : ''
              return (
                <button key={step} type="button" className={`cs-step ${state}`} onClick={() => goToStep(step)}>
                  <span>{step === 'closed' ? 'Closed State' : step}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="cs-top-actions">
          <button type="button" className="cs-nav-btn" onClick={handleSave}>Save</button>
          {isArtist && (
            <button type="button" className="cs-nav-btn publish" onClick={() => setShowPublish(true)}>
              Publish Template
            </button>
          )}
          <button type="button" className="cs-nav-btn accent" onClick={enterPreview}>
            <HiOutlineEye style={{ verticalAlign: 'middle', marginRight: 4 }} /> Preview
          </button>
          <button type="button" className="cs-nav-btn disabled" disabled>Send</button>
        </div>
      </div>

      {/* LAYOUT */}
      <div className="cs-layout">
        {/* TOOL RAIL */}
        <aside className="cs-toolrail">
          {tools.map(tool => {
            const Icon = tool.icon
            return (
              <button
                key={tool.id}
                type="button"
                className={`cs-tool ${activeTool === tool.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveTool(tool.id)
                  if (tool.id === 'closedState') setActiveStep('closed')
                  else if (tool.id === 'questions') setActiveStep('questions')
                  else setActiveStep('card')
                }}
                title={tool.label}
              >
                <span className="cs-tool-icon"><Icon size={20} /></span>
                <span className="cs-tool-meta">
                  <span className="cs-tool-label">{tool.label}</span>
                  <small>{tool.hint}</small>
                </span>
              </button>
            )
          })}
        </aside>

        {/* CANVAS */}
        <main className="cs-canvas-wrap">
          <div className="cs-canvas">
            <div className="cs-canvas-head">
              <div>
                <p className="eyebrow">Live Preview</p>
                <h2>Editable card preview</h2>
              </div>
              <button type="button" className="cs-preview-toggle" onClick={enterPreview}>
                <HiOutlineEye style={{ verticalAlign: 'middle', marginRight: 6 }} /> Full Preview
              </button>
            </div>

            {/* Phone frame */}
            <div className="cs-phone-frame">
              <div className="cs-phone-notch" />
              <div className="cs-phone-screen" style={{ background: previewBg }}>
                {/* Closed State Preview */}
                {activeStep === 'closed' && (
                  <div className="cs-preview-closed" style={{
                    backgroundColor: c.closedState.backgroundColor,
                    border: `2px solid ${c.closedState.borderColor}`,
                  }}>
                    <h3 style={{
                      color: c.closedState.headingColor,
                      fontFamily: `'${c.closedState.headingFont}', serif`,
                    }}>
                      {c.closedState.headingText}
                    </h3>
                    <p style={{ color: c.closedState.textColor }}>
                      {c.closedState.bodyText}
                    </p>
                    <button
                      type="button"
                      className="cs-preview-btn"
                      style={{
                        backgroundColor: c.closedState.button.backgroundColor,
                        color: c.closedState.button.textColor,
                        border: `1.5px solid ${c.closedState.button.borderColor}`,
                        borderRadius: btnShape,
                      }}
                    >
                      {c.closedState.button.text}
                    </button>
                  </div>
                )}

                {/* Card Content Preview */}
                {(activeStep === 'card' || activeStep === 'questions') && (
                  <div className="cs-preview-card" style={{
                    backgroundColor: c.card.backgroundColor,
                    ...cardBorderCss,
                  }}>
                    {c.media.images.length > 0 && (
                      <div className="cs-preview-media">
                        <img src={c.media.images[0].url} alt="" />
                      </div>
                    )}
                    <h3 style={{
                      color: c.card.headingColor,
                      fontFamily: `'${c.theme.fontFamily}', serif`,
                    }}>
                      {c.content.heading}
                    </h3>
                    <p style={{ color: c.card.textColor }}>{c.content.body}</p>
                    {c.content.extendedBody && (
                      <p className="cs-extended" style={{ color: c.card.textColor }}>
                        {c.content.extendedBody}
                      </p>
                    )}

                    {/* Questions preview */}
                    {c.questions.items.length > 0 && (
                      <div className="cs-preview-questions">
                        <p className="cs-q-label">Questions ({c.questions.items.length})</p>
                        {c.questions.items.map((q, i) => (
                          <div key={i} className="cs-q-preview-item">
                            <span>{q.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* SETTINGS PANEL */}
        <aside className="cs-settings">
          {renderPanel()}
        </aside>
      </div>

      {/* Mobile layout */}
      <div className="cs-mobile-shell">
        <div className="cs-mobile-header">
          <button type="button" className="cs-mobile-back" onClick={() => navigate(-1)}>‹</button>
          <div className="cs-mobile-title">Cardora Studio</div>
          <button type="button" className="cs-mobile-save" onClick={handleSave}>Save</button>
        </div>

        <div className="cs-mobile-preview" style={{ background: previewBg }}>
          {activeStep === 'closed' ? (
            <div className="cs-preview-closed compact" style={{
              backgroundColor: c.closedState.backgroundColor,
              border: `2px solid ${c.closedState.borderColor}`,
            }}>
              <h3 style={{ color: c.closedState.headingColor, fontFamily: `'${c.closedState.headingFont}', serif` }}>
                {c.closedState.headingText}
              </h3>
              <p style={{ color: c.closedState.textColor }}>{c.closedState.bodyText}</p>
            </div>
          ) : c.media.images.length > 0 ? (
            <img src={c.media.images[0].url} alt="" className="cs-mobile-img" />
          ) : (
            <div className="cs-mobile-card-hint" style={{ backgroundColor: c.card.backgroundColor }}>
              <h3 style={{ color: c.card.headingColor, fontFamily: `'${c.theme.fontFamily}', serif`, fontSize: '1rem' }}>
                {c.content.heading}
              </h3>
            </div>
          )}
        </div>

        <div className="cs-mobile-stepnav">
          {steps.map(step => (
            <button
              key={step}
              type="button"
              className={`cs-mobile-step ${activeStep === step ? 'active' : ''}`}
              onClick={() => goToStep(step)}
            >
              {step === 'closed' ? 'Closed' : step}
            </button>
          ))}
        </div>

        {/* Mobile tool selector */}
        <div className="cs-mobile-tools">
          {tools.map(tool => {
            const Icon = tool.icon
            return (
              <button
                key={tool.id}
                type="button"
                className={`cs-mobile-tool-chip ${activeTool === tool.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveTool(tool.id)
                  if (tool.id === 'closedState') setActiveStep('closed')
                  else if (tool.id === 'questions') setActiveStep('questions')
                  else setActiveStep('card')
                }}
              >
                <Icon size={16} />
                <span>{tool.label}</span>
              </button>
            )
          })}
        </div>

        {/* Mobile panel */}
        <div className="cs-mobile-panel">
          {renderPanel()}
        </div>

        <div className="cs-mobile-footer">
          <button type="button" className="cs-mobile-ghost" onClick={enterPreview}>
            <HiOutlineEye style={{ verticalAlign: 'middle', marginRight: 4 }} /> Preview
          </button>
          {isArtist ? (
            <button type="button" className="cs-mobile-primary" onClick={() => setShowPublish(true)}>Publish</button>
          ) : (
            <button type="button" className="cs-mobile-primary disabled" disabled>Send</button>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <CardPreviewModal
          cardObject={cardObject}
          onClose={() => {
            setShowPreview(false)
            if (activeStep === 'preview') setActiveStep('card')
          }}
        />
      )}

      {/* Publish Template Modal (Artists only) */}
      {showPublish && (
        <div className="cs-publish-overlay">
          <div className="cs-publish-backdrop" onClick={() => setShowPublish(false)} />
          <div className="cs-publish-modal">
            <h3>Publish Template</h3>
            <p>Your card will be submitted for review and added to the marketplace once approved.</p>
            <label className="cs-field">
              <span>Category</span>
              <select defaultValue="proposal">
                <option value="proposal">Proposal</option>
                <option value="anniversary">Anniversary</option>
                <option value="birthday">Birthday</option>
                <option value="scratch">General / Other</option>
              </select>
            </label>
            <label className="cs-field">
              <span>Template Name</span>
              <input defaultValue={c.content.heading} placeholder="Give your template a name" />
            </label>
            <div className="cs-publish-actions">
              <button
                type="button"
                className="cs-nav-btn publish"
                onClick={() => {
                  const published = JSON.parse(localStorage.getItem('cardora:publishedTemplates') || '[]')
                  published.unshift({
                    id: `tmpl-${Date.now()}`,
                    title: c.content.heading,
                    cardObject: structuredClone(cardObject),
                    publishedAt: new Date().toISOString(),
                    artist: currentUser?.name || 'Artist',
                    status: 'pending',
                  })
                  localStorage.setItem('cardora:publishedTemplates', JSON.stringify(published))
                  setShowPublish(false)
                  setSavedState('Template submitted!')
                }}
              >
                Submit for Review
              </button>
              <button type="button" className="cs-nav-btn" onClick={() => setShowPublish(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CardStudio
