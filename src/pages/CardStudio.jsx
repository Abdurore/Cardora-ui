import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import logo from '../assets/icons/logo.png'

const steps = ['envelope', 'card', 'questions', 'preview', 'send']

const tools = [
  { id: 'envelope', icon: 'EV', label: 'Envelope', hint: 'First impression and seal' },
  { id: 'text', icon: 'TX', label: 'Text', hint: 'Heading, body, and tone' },
  { id: 'media', icon: 'MD', label: 'Media', hint: 'Image, crop, and fit' },
  { id: 'theme', icon: 'TH', label: 'Theme', hint: 'Palette and surface mood' },
  { id: 'animation', icon: 'AN', label: 'Animations', hint: 'Entry and particles' },
  { id: 'questions', icon: 'QS', label: 'Questions', hint: 'Receiver interaction flow' },
  { id: 'gifts', icon: 'GF', label: 'Gifts', hint: 'Locked reward and claim state' },
]

const themes = {
  cardora: {
    name: 'Cardora Glow',
    accent: '#76efff',
    accentSoft: 'rgba(118,239,255,0.18)',
    cardBg: 'linear-gradient(180deg, rgba(11,28,36,0.96), rgba(5,14,20,0.98))',
  },
  minimal: {
    name: 'Minimal Night',
    accent: '#8cf2ff',
    accentSoft: 'rgba(140,242,255,0.16)',
    cardBg: 'linear-gradient(180deg, rgba(12,20,26,0.96), rgba(7,11,15,0.98))',
  },
  birthday: {
    name: 'Birthday Glow',
    accent: '#6fe6ff',
    accentSoft: 'rgba(111,230,255,0.16)',
    cardBg: 'linear-gradient(180deg, rgba(14,26,33,0.96), rgba(8,14,19,0.98))',
  },
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

function CardStudio() {
  const navigate = useNavigate()
  const location = useLocation()
  const cardData = useMemo(() => location.state?.cardData || null, [location.state])

  const [activeTool, setActiveTool] = useState('envelope')
  const [activeStep, setActiveStep] = useState('envelope')
  const [fullPreview, setFullPreview] = useState(false)
  const [selectedElement, setSelectedElement] = useState('heading')
  const [dragging, setDragging] = useState(null)
  const [dragOrigin, setDragOrigin] = useState({ x: 0, y: 0 })
  const [savedState, setSavedState] = useState('Draft saved 2 mins ago')
  const [themeId, setThemeId] = useState('cardora')
  const [envelope, setEnvelope] = useState({
    color: '#123746',
    seal: 'Heart',
    recipient: 'Alex',
    intro: 'A beautiful little moment is waiting inside.',
    isOpen: false,
  })
  const [text, setText] = useState({
    heading: cardData?.title || 'Happy Anniversary',
    body: 'I love you more than words can say. Forever & always.',
    font: 'Cinzel',
    size: 34,
    color: '#f1fbff',
    align: 'center',
    animation: 'Fade',
  })
  const [media, setMedia] = useState({
    image:
      'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=900&q=80',
    fit: 'cover',
    radius: 28,
    shadow: true,
  })
  const [motion, setMotion] = useState({
    entry: 'Float Up',
    duration: 2.6,
    particles: 'Sparkles',
    enabled: true,
  })
  const [questions, setQuestions] = useState([
    { id: 'q1', prompt: 'What should we relive first?', type: 'text' },
  ])
  const [gift, setGift] = useState({
    type: 'Monetary',
    value: '50 CC',
    message: 'A little extra glow for your day.',
    status: 'Pending',
  })
  const [sendInfo, setSendInfo] = useState({ recipient: 'alex@cardora.app', mode: 'Email' })
  const [titlePos, setTitlePos] = useState({ x: 0, y: -10 })
  const [bodyPos, setBodyPos] = useState({ x: 0, y: 14 })
  const [imagePos, setImagePos] = useState({ x: 0, y: 6 })
  const [sequenceStage, setSequenceStage] = useState('envelope')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [autoplay, setAutoplay] = useState(false)
  const [giftClaimed, setGiftClaimed] = useState(false)

  const activeTheme = themes[themeId]
  const panelMode = activeStep === 'preview' || activeStep === 'send' ? activeStep : activeTool
  const currentQuestion = questions[questionIndex] || null

  const goToStep = (step) => {
    setActiveStep(step)
    if (step === 'envelope') setActiveTool('envelope')
    if (step === 'card') setActiveTool('text')
    if (step === 'questions') setActiveTool('questions')
    if (step === 'preview') {
      setFullPreview(true)
      setSequenceStage('envelope')
      setQuestionIndex(0)
      setGiftClaimed(false)
      setAutoplay(false)
    }
    if (step !== 'preview') setFullPreview(false)
  }

  const updateQuestion = (id, field, value) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, [field]: value } : q)))
  }

  const startDrag = (event, key) => {
    if (fullPreview) return
    setDragging(key)
    setDragOrigin({ x: event.clientX, y: event.clientY })
    setSelectedElement(key)
  }

  const moveDrag = (event) => {
    if (!dragging) return
    const dx = event.clientX - dragOrigin.x
    const dy = event.clientY - dragOrigin.y
    const next = (state) => ({
      x: clamp(Math.round((state.x + dx) / 6) * 6, -54, 54),
      y: clamp(Math.round((state.y + dy) / 6) * 6, -54, 72),
    })
    if (dragging === 'heading') setTitlePos((prev) => next(prev))
    if (dragging === 'body') setBodyPos((prev) => next(prev))
    if (dragging === 'image') setImagePos((prev) => next(prev))
    setDragOrigin({ x: event.clientX, y: event.clientY })
  }

  const uploadMedia = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setMedia((prev) => ({ ...prev, image: reader.result }))
      }
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const rewriteCopy = () => {
    setText((prev) => ({
      ...prev,
      heading: 'For the memory we are still creating',
      body: 'Tonight feels soft, bright, and completely ours. I wanted this card to hold that feeling for a little longer.',
    }))
    setSavedState('Copy refreshed')
  }

  const nextSequence = () => {
    if (sequenceStage === 'envelope') {
      setEnvelope((prev) => ({ ...prev, isOpen: true }))
      setSequenceStage('card')
      return
    }
    if (sequenceStage === 'card') {
      setSequenceStage(questions.length ? 'questions' : 'gift')
      return
    }
    if (sequenceStage === 'questions') {
      if (questionIndex < questions.length - 1) {
        setQuestionIndex((prev) => prev + 1)
        return
      }
      setSequenceStage('gift')
      return
    }
    if (sequenceStage === 'gift') {
      setGiftClaimed(true)
      setGift((prev) => ({ ...prev, status: 'Opened' }))
      setSequenceStage('end')
    }
  }

  const resetSequence = () => {
    setAutoplay(false)
    setSequenceStage('envelope')
    setQuestionIndex(0)
    setGiftClaimed(false)
    setEnvelope((prev) => ({ ...prev, isOpen: false }))
    setGift((prev) => ({ ...prev, status: 'Pending' }))
  }

  const enterPreview = () => {
    goToStep('preview')
    resetSequence()
    setFullPreview(true)
  }

  useEffect(() => {
    if (!fullPreview || !autoplay) return
    if (sequenceStage === 'end') {
      setAutoplay(false)
      return
    }
    const timer = setTimeout(() => {
      nextSequence()
    }, sequenceStage === 'questions' ? 1800 : 1400)
    return () => clearTimeout(timer)
  }, [autoplay, fullPreview, questionIndex, sequenceStage])

  const renderPanel = () => {
    if (panelMode === 'envelope') {
      return (
        <>
          <p className="studio-v2-panel-eyebrow">Envelope Tool</p>
          <h3>Set the first emotional cue.</h3>
          <label className="studio-v2-field">
            <span>Envelope color</span>
            <input type="color" value={envelope.color} onChange={(e) => setEnvelope((p) => ({ ...p, color: e.target.value }))} />
          </label>
          <div className="studio-v2-choice-row">
            {['Heart', 'Wax', 'Minimal'].map((seal) => (
              <button key={seal} type="button" className={`studio-v2-chip ${envelope.seal === seal ? 'active' : ''}`} onClick={() => setEnvelope((p) => ({ ...p, seal }))}>{seal}</button>
            ))}
          </div>
          <label className="studio-v2-field">
            <span>Recipient name</span>
            <input value={envelope.recipient} onChange={(e) => setEnvelope((p) => ({ ...p, recipient: e.target.value }))} />
          </label>
          <label className="studio-v2-field">
            <span>Intro text</span>
            <textarea rows="3" value={envelope.intro} onChange={(e) => setEnvelope((p) => ({ ...p, intro: e.target.value }))} />
          </label>
          <button type="button" className="studio-v2-button" onClick={() => setEnvelope((p) => ({ ...p, isOpen: !p.isOpen }))}>
            {envelope.isOpen ? 'Preview close animation' : 'Preview open animation'}
          </button>
        </>
      )
    }

    if (panelMode === 'text') {
      return (
        <>
          <p className="studio-v2-panel-eyebrow">Text Tool</p>
          <h3>Shape the voice of the card.</h3>
          <div className="studio-v2-choice-row">
            {['heading', 'body'].map((item) => (
              <button key={item} type="button" className={`studio-v2-chip ${selectedElement === item ? 'active' : ''}`} onClick={() => setSelectedElement(item)}>
                {item}
              </button>
            ))}
          </div>
          <label className="studio-v2-field">
            <span>Heading</span>
            <input value={text.heading} onChange={(e) => setText((p) => ({ ...p, heading: e.target.value }))} />
          </label>
          <label className="studio-v2-field">
            <span>Body text</span>
            <textarea rows="4" value={text.body} onChange={(e) => setText((p) => ({ ...p, body: e.target.value }))} />
          </label>
          <label className="studio-v2-field">
            <span>Font</span>
            <select value={text.font} onChange={(e) => setText((p) => ({ ...p, font: e.target.value }))}>
              <option>Cinzel</option>
              <option>Manrope</option>
              <option>Playfair</option>
            </select>
          </label>
          <label className="studio-v2-field">
            <span>Size</span>
            <input type="range" min="22" max="48" value={text.size} onChange={(e) => setText((p) => ({ ...p, size: Number(e.target.value) }))} />
          </label>
          <label className="studio-v2-field">
            <span>Color</span>
            <input type="color" value={text.color} onChange={(e) => setText((p) => ({ ...p, color: e.target.value }))} />
          </label>
          <div className="studio-v2-choice-row">
            {['left', 'center', 'right'].map((align) => (
              <button key={align} type="button" className={`studio-v2-chip ${text.align === align ? 'active' : ''}`} onClick={() => setText((p) => ({ ...p, align }))}>{align}</button>
            ))}
          </div>
          <label className="studio-v2-field">
            <span>Animation</span>
            <select value={text.animation} onChange={(e) => setText((p) => ({ ...p, animation: e.target.value }))}>
              <option>Fade</option>
              <option>Slide</option>
              <option>Typewriter</option>
            </select>
          </label>
          <button type="button" className="studio-v2-button" onClick={rewriteCopy}>Rewrite with AI</button>
        </>
      )
    }

    if (panelMode === 'media') {
      return (
        <>
          <p className="studio-v2-panel-eyebrow">Media Tool</p>
          <h3>Control the visual centerpiece.</h3>
          <label className="studio-v2-upload">
            <span>Upload image</span>
            <input type="file" accept="image/*" onChange={uploadMedia} />
          </label>
          <label className="studio-v2-field">
            <span>Image fit</span>
            <select value={media.fit} onChange={(e) => setMedia((p) => ({ ...p, fit: e.target.value }))}>
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
            </select>
          </label>
          <label className="studio-v2-field">
            <span>Border radius</span>
            <input type="range" min="12" max="40" value={media.radius} onChange={(e) => setMedia((p) => ({ ...p, radius: Number(e.target.value) }))} />
          </label>
          <button type="button" className={`studio-v2-chip ${media.shadow ? 'active' : ''}`} onClick={() => setMedia((p) => ({ ...p, shadow: !p.shadow }))}>
            {media.shadow ? 'Shadow enabled' : 'Shadow disabled'}
          </button>
        </>
      )
    }

    if (panelMode === 'theme') {
      return (
        <>
          <p className="studio-v2-panel-eyebrow">Theme Tool</p>
          <h3>Keep the feeling premium and restrained.</h3>
          <div className="studio-v2-theme-list">
            {Object.entries(themes).map(([key, value]) => (
              <button key={key} type="button" className={`studio-v2-theme-card ${themeId === key ? 'active' : ''}`} onClick={() => setThemeId(key)}>
                <span className="studio-v2-theme-swatch" style={{ background: value.accent }} />
                <span>{value.name}</span>
              </button>
            ))}
          </div>
        </>
      )
    }

    if (panelMode === 'animation') {
      return (
        <>
          <p className="studio-v2-panel-eyebrow">Animation Tool</p>
          <h3>Let the motion stay soft and cinematic.</h3>
          <label className="studio-v2-field">
            <span>Entry animation</span>
            <select value={motion.entry} onChange={(e) => setMotion((p) => ({ ...p, entry: e.target.value }))}>
              <option>Float Up</option>
              <option>Soft Fade</option>
              <option>Slow Zoom</option>
            </select>
          </label>
          <label className="studio-v2-field">
            <span>Duration</span>
            <input type="range" min="1.4" max="4" step="0.1" value={motion.duration} onChange={(e) => setMotion((p) => ({ ...p, duration: Number(e.target.value) }))} />
          </label>
          <div className="studio-v2-choice-row">
            {['Sparkles', 'Hearts'].map((particles) => (
              <button key={particles} type="button" className={`studio-v2-chip ${motion.particles === particles ? 'active' : ''}`} onClick={() => setMotion((p) => ({ ...p, particles }))}>{particles}</button>
            ))}
          </div>
          <button type="button" className={`studio-v2-chip ${motion.enabled ? 'active' : ''}`} onClick={() => setMotion((p) => ({ ...p, enabled: !p.enabled }))}>
            {motion.enabled ? 'Particles on' : 'Particles off'}
          </button>
        </>
      )
    }

    if (panelMode === 'questions') {
      return (
        <>
          <p className="studio-v2-panel-eyebrow">Questions Tool</p>
          <h3>Build the interaction after the reveal.</h3>
          {questions.map((question) => (
            <div key={question.id} className="studio-v2-question-card">
              <label className="studio-v2-field">
                <span>Prompt</span>
                <input value={question.prompt} onChange={(e) => updateQuestion(question.id, 'prompt', e.target.value)} />
              </label>
              <label className="studio-v2-field">
                <span>Answer type</span>
                <select value={question.type} onChange={(e) => updateQuestion(question.id, 'type', e.target.value)}>
                  <option value="text">Text</option>
                  <option value="multiple choice">Multiple choice</option>
                  <option value="emoji reaction">Emoji reaction</option>
                </select>
              </label>
            </div>
          ))}
          <button type="button" className="studio-v2-button" onClick={() => setQuestions((prev) => [...prev, { id: `q${Date.now()}`, prompt: 'Add a new question', type: 'text' }])}>
            Add new question
          </button>
        </>
      )
    }

    if (panelMode === 'gifts') {
      return (
        <>
          <p className="studio-v2-panel-eyebrow">Gift Tool</p>
          <h3>Embed a reward into the experience.</h3>
          <div className="studio-v2-choice-row">
            {['Monetary', 'Digital item'].map((type) => (
              <button key={type} type="button" className={`studio-v2-chip ${gift.type === type ? 'active' : ''}`} onClick={() => setGift((p) => ({ ...p, type }))}>{type}</button>
            ))}
          </div>
          <label className="studio-v2-field">
            <span>Amount / value</span>
            <input value={gift.value} onChange={(e) => setGift((p) => ({ ...p, value: e.target.value }))} />
          </label>
          <label className="studio-v2-field">
            <span>Gift message</span>
            <textarea rows="3" value={gift.message} onChange={(e) => setGift((p) => ({ ...p, message: e.target.value }))} />
          </label>
          <div className="studio-v2-stat-list">
            <div className="studio-v2-stat"><span>Status</span><strong>{gift.status}</strong></div>
            <div className="studio-v2-stat"><span>Receiver CTA</span><strong>{gift.type === 'Monetary' ? 'Claim Gift' : 'Redeem Item'}</strong></div>
          </div>
          <div className="studio-v2-choice-row">
            {['Pending', 'Viewed', 'Opened'].map((status) => (
              <button
                key={status}
                type="button"
                className={`studio-v2-chip ${gift.status === status ? 'active' : ''}`}
                onClick={() => setGift((p) => ({ ...p, status }))}
              >
                {status}
              </button>
            ))}
          </div>
        </>
      )
    }

    if (panelMode === 'preview') {
      return (
        <>
          <p className="studio-v2-panel-eyebrow">Preview Mode</p>
          <h3>Experience the card exactly like a receiver would.</h3>
          <div className="studio-v2-stat-list">
            {[`Stage: ${sequenceStage}`, `${questions.length} question flow`, 'Gift reveal sequence'].map((item) => (
              <div key={item} className="studio-v2-stat"><span>Included</span><strong>{item}</strong></div>
            ))}
          </div>
          <div className="studio-v2-choice-row">
            <button type="button" className="studio-v2-button" onClick={resetSequence}>Reset</button>
            <button type="button" className="studio-v2-button" onClick={nextSequence}>Next</button>
            <button type="button" className="studio-v2-button primary" onClick={() => setAutoplay((prev) => !prev)}>
              {autoplay ? 'Pause' : 'Play'}
            </button>
          </div>
        </>
      )
    }

    return (
      <>
        <p className="studio-v2-panel-eyebrow">Send Step</p>
        <h3>Confirm delivery and handoff.</h3>
        <label className="studio-v2-field">
          <span>Recipient detail</span>
          <input value={sendInfo.recipient} onChange={(e) => setSendInfo((p) => ({ ...p, recipient: e.target.value }))} />
        </label>
        <div className="studio-v2-choice-row">
          {['Email', 'Username'].map((mode) => (
            <button key={mode} type="button" className={`studio-v2-chip ${sendInfo.mode === mode ? 'active' : ''}`} onClick={() => setSendInfo((p) => ({ ...p, mode }))}>{mode}</button>
          ))}
        </div>
        <div className="studio-v2-stat-list">
          <div className="studio-v2-stat"><span>Delivered</span><strong>{sendInfo.recipient}</strong></div>
          <div className="studio-v2-stat"><span>Gift claim</span><strong>{gift.status}</strong></div>
        </div>
        <button
          type="button"
          className="studio-v2-button primary"
          onClick={() => {
            setSavedState(`Experience queued for ${sendInfo.recipient}`)
            setGift((prev) => ({ ...prev, status: 'Viewed' }))
          }}
        >
          Confirm Send
        </button>
      </>
    )
  }

  const renderMobileToolContent = () => {
    if (activeTool === 'envelope') {
      return (
        <div className="studio-v2-mobile-panel">
          <h3>Choose Envelope</h3>
          <div className="studio-v2-choice-row compact">
            {['Heart', 'Wax', 'Minimal'].map((seal) => (
              <button
                key={seal}
                type="button"
                className={`studio-v2-chip ${envelope.seal === seal ? 'active' : ''}`}
                onClick={() => setEnvelope((p) => ({ ...p, seal }))}
              >
                {seal}
              </button>
            ))}
          </div>
          <label className="studio-v2-field">
            <span>Recipient name</span>
            <input
              value={envelope.recipient}
              onChange={(e) => setEnvelope((p) => ({ ...p, recipient: e.target.value }))}
            />
          </label>
          <label className="studio-v2-field">
            <span>Intro text</span>
            <textarea
              rows="3"
              value={envelope.intro}
              onChange={(e) => setEnvelope((p) => ({ ...p, intro: e.target.value }))}
            />
          </label>
          <button type="button" className="studio-v2-button" onClick={rewriteCopy}>
            Rewrite with AI
          </button>
        </div>
      )
    }

    if (activeTool === 'text') {
      return (
        <div className="studio-v2-mobile-panel">
          <h3>Add Heading</h3>
          <label className="studio-v2-field">
            <span>Heading</span>
            <input value={text.heading} onChange={(e) => setText((p) => ({ ...p, heading: e.target.value }))} />
          </label>
          <label className="studio-v2-field">
            <span>Add body</span>
            <input value={text.body} onChange={(e) => setText((p) => ({ ...p, body: e.target.value }))} />
          </label>
          <label className="studio-v2-field">
            <span>Font</span>
            <div className="studio-v2-inline-control">
              <select value={text.font} onChange={(e) => setText((p) => ({ ...p, font: e.target.value }))}>
                <option>Cinzel</option>
                <option>Manrope</option>
                <option>Playfair</option>
              </select>
              <input type="range" min="22" max="48" value={text.size} onChange={(e) => setText((p) => ({ ...p, size: Number(e.target.value) }))} />
              <span>{text.size}</span>
            </div>
          </label>
          <div className="studio-v2-inline-control">
            <input type="color" value={text.color} onChange={(e) => setText((p) => ({ ...p, color: e.target.value }))} />
            {['left', 'center', 'right'].map((align) => (
              <button key={align} type="button" className={`studio-v2-chip icon ${text.align === align ? 'active' : ''}`} onClick={() => setText((p) => ({ ...p, align }))}>
                {align.charAt(0).toUpperCase()}
              </button>
            ))}
          </div>
          <label className="studio-v2-field">
            <span>Animation</span>
            <select value={text.animation} onChange={(e) => setText((p) => ({ ...p, animation: e.target.value }))}>
              <option>Fade</option>
              <option>Slide</option>
              <option>Typewriter</option>
            </select>
          </label>
        </div>
      )
    }

    if (activeTool === 'gifts') {
      return (
        <div className="studio-v2-mobile-panel">
          <h3>Added Gifts</h3>
          <div className="studio-v2-mobile-gift-list">
            <button type="button" className="studio-v2-mobile-gift-card" onClick={() => setGift((p) => ({ ...p, type: 'Digital item', value: '$20', message: 'For coffee & treats' }))}>
              <div className="studio-v2-mobile-gift-thumb">$20</div>
              <div>
                <strong>Gift card</strong>
                <p>For coffee & treats</p>
              </div>
            </button>
            <button type="button" className="studio-v2-mobile-gift-card" onClick={() => setGift((p) => ({ ...p, type: 'Monetary', value: 'N5,000', message: 'Little surprise for you' }))}>
              <div className="studio-v2-mobile-gift-thumb">N</div>
              <div>
                <strong>N5,000</strong>
                <p>Little surprise for you</p>
              </div>
            </button>
          </div>
          <button type="button" className="studio-v2-button">+ Add Gift</button>
        </div>
      )
    }

    return (
      <div className="studio-v2-mobile-panel studio-v2-mobile-tool-list">
        {tools.slice(0, 4).map((tool) => (
          <button
            key={tool.id}
            type="button"
            className="studio-v2-mobile-tool-card"
            onClick={() => setActiveTool(tool.id)}
          >
            <span className="studio-v2-mobile-tool-icon">{tool.icon}</span>
            <span className="studio-v2-mobile-tool-copy">
              <strong>{tool.label}</strong>
              <small>{tool.hint}</small>
            </span>
            <span className="studio-v2-mobile-arrow">›</span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="page-body studio-v2-shell">
      <div className="studio-v2-mobile-shell">
        <div className="studio-v2-mobile-phone">
          <div className="studio-v2-mobile-header">
            <button type="button" className="studio-v2-mobile-back" onClick={() => navigate(-1)}>
              ‹
            </button>
            <div className="studio-v2-mobile-title">
              <span>{activeStep === 'envelope' ? 'Cardora Studio' : 'Cardora'}</span>
            </div>
            <button
              type="button"
              className="studio-v2-mobile-save"
              onClick={() => (activeStep === 'send' ? goToStep('send') : setSavedState('Draft saved just now'))}
            >
              {activeStep === 'send' ? 'Send' : 'Save'}
            </button>
          </div>

          <div className="studio-v2-mobile-preview">
            {activeTool === 'envelope' && !fullPreview ? (
              <div className="studio-v2-mobile-envelope-preview" style={{ '--envelope-color': envelope.color }}>
                <div className="studio-v2-mobile-envelope-core" />
                <div className={`studio-v2-mobile-envelope-seal seal-${envelope.seal.toLowerCase()}`} />
              </div>
            ) : (
              <img src={media.image} alt="" className="studio-v2-mobile-image-preview" />
            )}
          </div>

          <div className="studio-v2-mobile-stepnav">
            {steps.map((step) => (
              <button
                key={step}
                type="button"
                className={`studio-v2-mobile-step ${activeStep === step ? 'active' : ''}`}
                onClick={() => goToStep(step)}
              >
                {step}
              </button>
            ))}
          </div>

          {renderMobileToolContent()}

          <div className="studio-v2-mobile-footer">
            <button type="button" className="studio-v2-mobile-ghost" onClick={enterPreview}>
              Preview
            </button>
            <button type="button" className="studio-v2-mobile-primary" onClick={() => goToStep('send')}>
              Send
            </button>
          </div>
        </div>
      </div>

      <div className="studio-v2-topbar">
        <div className="studio-v2-top-left">
          <button type="button" className="studio-v2-nav-btn" onClick={() => navigate(-1)}>Back</button>
          <div className="studio-v2-status">{savedState}</div>
        </div>
        <div className="studio-v2-progress">
          <div className="studio-v2-wordmark">
            <img src={logo} alt="Cardora logo" className="studio-v2-top-logo" />
            <span>Cardora Studio</span>
          </div>
          <div className="studio-v2-steps">
            {steps.map((step, index) => {
              const activeIndex = steps.indexOf(activeStep)
              const state = index === activeIndex ? 'active' : index < activeIndex ? 'done' : ''
              return (
                <button key={step} type="button" className={`studio-v2-step ${state}`} onClick={() => goToStep(step)}>
                  <span>{step}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="studio-v2-top-actions">
          <button type="button" className="studio-v2-nav-btn" onClick={() => setSavedState('Draft saved just now')}>Save</button>
          <button type="button" className="studio-v2-nav-btn" onClick={enterPreview}>Preview</button>
          <button type="button" className="studio-v2-nav-btn primary" onClick={() => goToStep('send')}>Send</button>
        </div>
      </div>

      <div className="studio-v2-layout">
        <aside className="studio-v2-toolrail">
          {tools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              className={`studio-v2-tool ${activeTool === tool.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTool(tool.id)
                if (tool.id === 'envelope') setActiveStep('envelope')
                if (tool.id === 'questions') setActiveStep('questions')
                if (tool.id === 'gifts') setActiveStep('card')
                if (['text', 'media', 'theme', 'animation'].includes(tool.id)) setActiveStep('card')
              }}
              title={tool.label}
            >
              <span className="studio-v2-tool-icon">{tool.icon}</span>
              <span className="studio-v2-tool-meta">
                <span className="studio-v2-tool-label">{tool.label}</span>
                <small>{tool.hint}</small>
              </span>
            </button>
          ))}
        </aside>

        <main className="studio-v2-canvas-wrap">
          <div
            className={`studio-v2-canvas ${fullPreview ? 'previewing' : ''}`}
            style={{ '--studio-accent': activeTheme.accent, '--studio-accent-soft': activeTheme.accentSoft }}
            onPointerMove={moveDrag}
            onPointerUp={() => setDragging(null)}
            onPointerLeave={() => setDragging(null)}
          >
            <div className="studio-v2-canvas-head">
              <div>
                <p className="eyebrow">Live Preview</p>
                <h2>{fullPreview ? 'Receiver experience flow' : 'Editable mobile experience'}</h2>
              </div>
              <button
                type="button"
                className={`studio-v2-preview-toggle ${fullPreview ? 'active' : ''}`}
                onClick={() => {
                  if (fullPreview) {
                    setFullPreview(false)
                    setActiveStep('card')
                    setAutoplay(false)
                  } else {
                    enterPreview()
                  }
                }}
              >
                {fullPreview ? 'Editing' : 'Full Preview'}
              </button>
            </div>
            {motion.enabled ? (
              <div className={`studio-v2-particles ${motion.particles === 'Hearts' ? 'hearts' : 'sparkles'}`}>
                {Array.from({ length: 12 }).map((_, index) => (
                  <span key={`particle-${index}`} className={`studio-v2-particle p${(index % 6) + 1}`}>{motion.particles === 'Hearts' ? 'o' : '*'}</span>
                ))}
              </div>
            ) : null}
            <div className="studio-v2-phone-frame">
              <div className="studio-v2-phone-notch" />
              <div className="studio-v2-phone-screen">
                {fullPreview ? (
                  <div className="studio-v2-sequence">
                    <div className={`studio-v2-envelope-stage ${sequenceStage !== 'envelope' ? 'open' : ''}`} style={{ '--envelope-color': envelope.color }}>
                      <div className="studio-v2-envelope-letter"><span>To: {envelope.recipient}</span><span>{envelope.intro}</span></div>
                      <div className={`studio-v2-envelope-seal seal-${envelope.seal.toLowerCase()}`}>{envelope.seal}</div>
                      <div className="studio-v2-envelope-back" />
                      <div className="studio-v2-envelope-flap" />
                    </div>
                    {sequenceStage === 'envelope' ? (
                      <button type="button" className="studio-v2-sequence-btn" onClick={nextSequence}>Open Envelope</button>
                    ) : null}
                    {sequenceStage === 'card' ? (
                      <article className="studio-v2-sequence-card" style={{ background: activeTheme.cardBg }}>
                        <img src={media.image} alt="" />
                        <h3>{text.heading}</h3>
                        <p>{text.body}</p>
                        <button type="button" className="studio-v2-sequence-btn" onClick={nextSequence}>
                          {questions.length ? 'Continue to Questions' : 'Continue to Gift'}
                        </button>
                      </article>
                    ) : null}
                    {sequenceStage === 'questions' && currentQuestion ? (
                      <div className="studio-v2-sequence-card question" style={{ background: activeTheme.cardBg }}>
                        <p className="studio-v2-flow-label">Question {questionIndex + 1}</p>
                        <h3>{currentQuestion.prompt}</h3>
                        <div className="studio-v2-sequence-actions">
                          {currentQuestion.type === 'text' ? (
                            <input value="Type your answer..." readOnly />
                          ) : currentQuestion.type === 'multiple choice' ? (
                            <>
                              <button type="button" className="studio-v2-chip" onClick={nextSequence}>Yes</button>
                              <button type="button" className="studio-v2-chip" onClick={nextSequence}>Absolutely</button>
                            </>
                          ) : (
                            <>
                              <button type="button" className="studio-v2-chip" onClick={nextSequence}>Love</button>
                              <button type="button" className="studio-v2-chip" onClick={nextSequence}>Wow</button>
                            </>
                          )}
                        </div>
                        {currentQuestion.type === 'text' ? (
                          <button type="button" className="studio-v2-sequence-btn" onClick={nextSequence}>Submit Answer</button>
                        ) : null}
                      </div>
                    ) : null}
                    {sequenceStage === 'gift' ? (
                      <div className="studio-v2-sequence-card gift" style={{ background: activeTheme.cardBg }}>
                        <p className="studio-v2-flow-label">Gift Reveal</p>
                        <h3>A gift has been sent to you</h3>
                        <strong>{gift.type}</strong>
                        <span>{gift.value}</span>
                        <p>{gift.message}</p>
                        <div className="studio-v2-sequence-actions">
                          <button type="button" className="studio-v2-sequence-btn" onClick={nextSequence}>
                            {gift.type === 'Monetary' ? 'Claim Gift' : 'Redeem'}
                          </button>
                          <button type="button" className="studio-v2-nav-btn" onClick={nextSequence}>View Instructions</button>
                        </div>
                      </div>
                    ) : null}
                    {sequenceStage === 'end' ? (
                      <div className="studio-v2-sequence-card end" style={{ background: activeTheme.cardBg }}>
                        <p className="studio-v2-flow-label">End Screen</p>
                        <h3>{giftClaimed ? 'Gift revealed successfully' : 'Card complete'}</h3>
                        <p>Envelope, message, questions, and gift flow all played in sequence.</p>
                        <div className="studio-v2-sequence-actions">
                          <button type="button" className="studio-v2-nav-btn" onClick={resetSequence}>Replay</button>
                          <button type="button" className="studio-v2-sequence-btn" onClick={() => goToStep('send')}>Create Yours</button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div className={`studio-v2-envelope-stage ${envelope.isOpen ? 'open' : ''}`} style={{ '--envelope-color': envelope.color }}>
                      <div className="studio-v2-envelope-letter"><span>To: {envelope.recipient}</span><span>{envelope.intro}</span></div>
                      <div className={`studio-v2-envelope-seal seal-${envelope.seal.toLowerCase()}`}>{envelope.seal}</div>
                      <div className="studio-v2-envelope-back" />
                      <div className="studio-v2-envelope-flap" />
                    </div>

                    <article className="studio-v2-card-surface" style={{ background: activeTheme.cardBg }}>
                      <button
                        type="button"
                        className={`studio-v2-media ${selectedElement === 'image' ? 'active' : ''}`}
                        style={{ transform: `translate(${imagePos.x}px, ${imagePos.y}px)`, borderRadius: `${media.radius}px`, boxShadow: media.shadow ? '0 20px 40px rgba(0,0,0,0.28)' : 'none' }}
                        onPointerDown={(event) => startDrag(event, 'image')}
                        onClick={() => { setSelectedElement('image'); setActiveTool('media') }}
                      >
                        <img src={media.image} alt="" style={{ objectFit: media.fit }} />
                      </button>

                      <div
                        className={`studio-v2-heading ${selectedElement === 'heading' ? 'active' : ''}`}
                        style={{ transform: `translate(${titlePos.x}px, ${titlePos.y}px)`, color: text.color, textAlign: text.align, fontSize: `${text.size}px`, fontFamily: text.font === 'Cinzel' ? "'Cinzel', serif" : "'Manrope', sans-serif" }}
                        onPointerDown={(event) => startDrag(event, 'heading')}
                        onClick={() => { setSelectedElement('heading'); setActiveTool('text') }}
                      >
                        {selectedElement === 'heading' ? <input value={text.heading} onChange={(e) => setText((p) => ({ ...p, heading: e.target.value }))} /> : <span>{text.heading}</span>}
                      </div>

                      <div
                        className={`studio-v2-bodycopy ${selectedElement === 'body' ? 'active' : ''}`}
                        style={{ transform: `translate(${bodyPos.x}px, ${bodyPos.y}px)`, color: text.color, textAlign: text.align }}
                        onPointerDown={(event) => startDrag(event, 'body')}
                        onClick={() => { setSelectedElement('body'); setActiveTool('text') }}
                      >
                        {selectedElement === 'body' ? <textarea rows="3" value={text.body} onChange={(e) => setText((p) => ({ ...p, body: e.target.value }))} /> : <p>{text.body}</p>}
                      </div>

                      <div className="studio-v2-flow-block">
                        <p className="studio-v2-flow-label">Questions</p>
                        {questions.map((question) => (
                          <div key={question.id} className="studio-v2-question-preview">
                            <span>{question.prompt}</span>
                            <small>{question.type}</small>
                          </div>
                        ))}
                      </div>

                      <div className="studio-v2-flow-block gift">
                        <p className="studio-v2-flow-label">Gift Locked</p>
                        <div className="studio-v2-gift-preview">
                          <strong>{gift.type}</strong>
                          <span>{gift.value}</span>
                          <p>{gift.message}</p>
                          <button type="button" onClick={() => setActiveTool('gifts')}>
                            Edit Gift
                          </button>
                        </div>
                      </div>
                    </article>
                  </>
                )}
              </div>
            </div>
          </div>
        </main>

        <aside className="studio-v2-settings">
          {renderPanel()}
        </aside>
      </div>
    </div>
  )
}

export default CardStudio
