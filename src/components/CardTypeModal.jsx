import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { PersonalCardIcon, PollCardIcon, TriviaCardIcon, ChainCardIcon, AnonCardIcon } from './CardIcons.jsx'
import { EXPLORE_OCCASION_TABS, categoryToOccasionTab } from '../lib/occasionTaxonomy.js'
import { trackEvent } from '../lib/api.js'

// 6.1: "Remove the fork. Everyone lands in the simple path. Templates are
// step zero." This used to be a two-step picker (card type, then an
// upfront "How do you want to build?" Quick-vs-Studio choice) — the second
// step is gone entirely. Personal cards (the common case) now start at an
// occasion/template grid instead of an abstract type description; Studio
// is reached later, as an upgrade from inside the simple editor, never as
// a choice made before the sender has built anything.
const SECONDARY_TYPES = [
  { id: 'poll', icon: PollCardIcon, label: 'Poll', accent: 'cool' },
  { id: 'trivia', icon: TriviaCardIcon, label: 'Trivia', accent: 'rose' },
  { id: 'chain', icon: ChainCardIcon, label: 'Chain', accent: 'emerald' },
  { id: 'anonymous', icon: AnonCardIcon, label: 'Anonymous', accent: 'mint' },
]

function CardTypeModal({
  open,
  onClose,
  preselectedType,
  currentUser = null,
  marketplaceTemplates = [],
  balance = 0,
  unlockTemplateAction,
  openAuthModal,
}) {
  const navigate = useNavigate()
  const isArtist = String(currentUser?.role || '').toLowerCase() === 'artist'
  const [view, setView] = useState('occasion') // 'occasion' | 'templates' | 'unlock'
  const [activeOccasion, setActiveOccasion] = useState(null)
  const [unlockTarget, setUnlockTarget] = useState(null)
  const [unlocking, setUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState('')

  useEffect(() => {
    if (!open) return
    setView('occasion')
    setActiveOccasion(null)
    setUnlockTarget(null)
    setUnlockError('')

    // Artists keep their existing distinct flow (Publish, not Send) --
    // 6.1 doesn't touch it, only the sender-facing fork.
    if (isArtist) {
      onClose()
      navigate(`/studio?type=${preselectedType || 'personal'}`, { state: { isNew: true } })
      return
    }
    // A non-personal preselect (e.g. Home's format tiles) has no occasion
    // grid to show -- it lands straight in the simple editor for that type.
    if (preselectedType && preselectedType !== 'personal') {
      onClose()
      navigate(`/quick?type=${preselectedType}`)
      return
    }
    trackEvent('create_flow_entry', { preselectedType: preselectedType || null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preselectedType, isArtist])

  const cardSource = useMemo(
    () => (marketplaceTemplates || []).filter((t) => !t.status || t.status === 'approved' || t.status === 'live'),
    [marketplaceTemplates],
  )

  const templatesForOccasion = useMemo(() => {
    if (!activeOccasion) return []
    return cardSource.filter((t) => (
      categoryToOccasionTab(t.category) === activeOccasion
      && (!t.type || t.type === 'personal')
    ))
  }, [cardSource, activeOccasion])

  // Artists and non-personal preselects redirect away entirely (handled in
  // the effect above) -- returning null here too means that redirect never
  // has to render the full picker first, even for one frame.
  if (!open || isArtist || (preselectedType && preselectedType !== 'personal')) return null

  const goToQuick = (type, template) => {
    onClose()
    const templateId = template ? (template.templateId || template.id) : ''
    navigate(`/quick?type=${type}${templateId ? `&template=${encodeURIComponent(templateId)}` : ''}`)
  }

  const handleStartBlank = () => {
    trackEvent('create_flow_step', { step: 'start_blank' })
    goToQuick('personal', null)
  }

  const handlePickOccasion = (occasion) => {
    setActiveOccasion(occasion)
    setView('templates')
    trackEvent('create_flow_step', { step: 'occasion_selected', occasion })
  }

  const handlePickSecondaryType = (typeId) => {
    trackEvent('create_flow_step', { step: 'secondary_type_selected', type: typeId })
    goToQuick(typeId, null)
  }

  const handlePickTemplate = (template) => {
    const price = Number(template.price || 0)
    const locked = price > 0 && template.isUnlocked === false
    trackEvent('create_flow_step', { step: 'template_selected', templateId: template.templateId || template.id, locked })
    if (!locked) {
      goToQuick('personal', template)
      return
    }
    if (!currentUser) {
      openAuthModal?.()
      return
    }
    setUnlockTarget(template)
    setView('unlock')
    setUnlockError('')
  }

  const handleConfirmUnlock = async () => {
    if (!unlockTarget) return
    setUnlocking(true)
    setUnlockError('')
    const templateId = unlockTarget.templateId || unlockTarget.id
    const result = await unlockTemplateAction?.(templateId)
    setUnlocking(false)
    if (!result?.ok) {
      setUnlockError(result?.message || 'Could not unlock this template.')
      return
    }
    goToQuick('personal', unlockTarget)
  }

  const handleBack = () => {
    if (view === 'unlock') {
      setView('templates')
      setUnlockTarget(null)
      setUnlockError('')
      return
    }
    if (view === 'templates') {
      setView('occasion')
      setActiveOccasion(null)
      return
    }
    onClose()
  }

  return (
    <section className="ctm-overlay" role="dialog" aria-modal="true" aria-label="Create a card">
      <div className="ctm-backdrop" onClick={onClose} />
      <div className="ctm-shell">
        <div className="ctm-header">
          <button type="button" className="ctm-back" onClick={handleBack}>
            {view === 'occasion' ? '✕' : '← Back'}
          </button>
          <div className="ctm-header-text">
            <p className="eyebrow">Create a Card</p>
            <h2>
              {view === 'occasion' && "What's this for?"}
              {view === 'templates' && activeOccasion}
              {view === 'unlock' && 'Unlock this template'}
            </h2>
          </div>
        </div>

        {view === 'occasion' && (
          <>
            <div className="ctm-occasion-grid">
              <button type="button" className="ctm-card ctm-occasion-card ctm-occasion-blank" onClick={handleStartBlank}>
                <span className="ctm-occasion-icon">✎</span>
                <strong>Start blank</strong>
                <p>Build from scratch</p>
              </button>
              {EXPLORE_OCCASION_TABS.map((occ) => (
                <button key={occ} type="button" className="ctm-card ctm-occasion-card" onClick={() => handlePickOccasion(occ)}>
                  <strong>{occ}</strong>
                </button>
              ))}
            </div>
            <p className="ctm-secondary-label">Or build something interactive</p>
            <div className="ctm-secondary-row">
              {SECONDARY_TYPES.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  className={`ctm-card ctm-secondary-card ctm-${type.accent}`}
                  onClick={() => handlePickSecondaryType(type.id)}
                >
                  <type.icon size={20} />
                  <span>{type.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {view === 'templates' && (
          <div className="ctm-template-grid">
            {templatesForOccasion.map((t) => {
              const price = Number(t.price || 0)
              const locked = price > 0 && t.isUnlocked === false
              return (
                <button
                  key={t.templateId || t.id}
                  type="button"
                  className="ctm-card ctm-template-card"
                  onClick={() => handlePickTemplate(t)}
                >
                  {t.previewImage ? <img src={t.previewImage} alt="" className="ctm-template-preview" /> : null}
                  <strong>{t.title}</strong>
                  <span className="ctm-template-price">
                    {price <= 0 ? 'Use free' : locked ? `${price} CC` : 'Use'}
                  </span>
                </button>
              )
            })}
            {templatesForOccasion.length === 0 && (
              <p className="ctm-template-empty-note">No templates yet for {activeOccasion} — start blank instead.</p>
            )}
            <button type="button" className="ctm-card ctm-template-card ctm-template-blank" onClick={handleStartBlank}>
              <strong>Start blank</strong>
              <p>Skip templates for this one</p>
            </button>
          </div>
        )}

        {view === 'unlock' && unlockTarget && (
          <div className="ctm-unlock-panel">
            <p className="ctm-unlock-title">{unlockTarget.title}</p>
            <div className="ctm-unlock-summary">
              <span>Price</span>
              <strong>{unlockTarget.price} CC</strong>
            </div>
            <div className="ctm-unlock-summary">
              <span>Your balance</span>
              <strong>{balance} CC</strong>
            </div>
            {unlockError && <p className="form-error">{unlockError}</p>}
            <button className="primary" type="button" onClick={handleConfirmUnlock} disabled={unlocking}>
              {unlocking ? 'Unlocking…' : `Unlock — ${unlockTarget.price} CC`}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

export default CardTypeModal
