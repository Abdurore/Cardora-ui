import { Link, useOutletContext } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import CardItem from '../components/CardItem.jsx'
import { getSignupBonusAvailability } from '../lib/api.js'

const FORMAT_CHIPS = [
  { icon: '✉', label: 'Greeting', cls: 'chip-greeting' },
  { icon: '📊', label: 'Poll',     cls: 'chip-poll' },
  { icon: '💡', label: 'Trivia',   cls: 'chip-trivia' },
  { icon: '👁', label: 'Anonymous', cls: 'chip-anon' },
  { icon: '🔗', label: 'Chain',    cls: 'chip-chain' },
]

const CARD_FORMATS = [
  {
    icon: '💌',
    title: 'Personal Cards',
    tagline: 'Cinematic reveals with music.',
    description: 'Envelope, glow, music, and a more personal kind of message.',
    accent: 'warm',
    cta: 'Try it',
    typePreselect: 'personal',
  },
  {
    icon: '📊',
    title: 'Poll Cards',
    tagline: 'Ask and measure the mood.',
    description: 'Drop a live poll into the card and let people vote in place.',
    accent: 'cool',
    cta: 'Try it',
    typePreselect: 'poll',
  },
  {
    icon: '💡',
    title: 'Trivia Cards',
    tagline: 'Turn the card into a challenge.',
    description: 'Build a short quiz and reveal the score at the end.',
    accent: 'rose',
    cta: 'Try it',
    typePreselect: 'trivia',
  },
  {
    icon: '👁',
    title: 'Anonymous Inbox',
    tagline: 'Open the door to honest messages.',
    description: 'Share one link and collect anonymous notes inside your card design.',
    accent: 'mint',
    cta: 'Set up yours',
    typePreselect: 'anonymous',
  },
  {
    icon: '🔗',
    title: 'Chain Cards',
    tagline: 'Send one. Pull one back.',
    description: 'Invite the recipient to answer with a card of their own.',
    accent: 'teal',
    cta: 'Try it',
    to: '/studio?type=chain&tier=classic',
    typePreselect: 'chain',
  },
]

const HOW_IT_WORKS = [
  {
    icon: '01',
    title: 'Choose a Format',
    description: 'Pick from Greeting, Poll, Trivia, Chain, or Anonymous Inbox — each format built for a different kind of moment.',
  },
  {
    icon: '02',
    title: 'Build Your Card',
    description: 'Design with artist templates, customize colors, add music, and tune every detail in the Studio.',
  },
  {
    icon: '03',
    title: 'Pick a Tier',
    description: 'Classic is free. Premium and Elite unlock cinematic effects, rich animations, and premium sound.',
  },
  {
    icon: '04',
    title: 'Share & Get Replies',
    description: 'Send your link, get responses, and see how your audience reacted — all in one place.',
  },
]

const TIERS = [
  {
    name: 'Classic',
    label: 'Simple animation',
    note: 'A clean animated reveal for smaller moments.',
    details: 'No music',
    className: 'basic',
  },
  {
    name: 'Premium',
    label: 'Music + better visuals',
    note: 'Richer motion, stronger glow, and a more immersive flow.',
    details: 'Signature sound',
    className: 'premium',
  },
  {
    name: 'Elite',
    label: 'Full animations + effects',
    note: 'The complete Cardora experience with gifts and premium music.',
    details: 'Premium music',
    className: 'premium-plus',
  },
]

function Home() {
  const {
    openCardDetails,
    favorites,
    toggleFavorite,
    currentUser,
    openAuthModal,
    balance,
    marketplaceTemplates,
    openCardTypeModal,
  } = useOutletContext()
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [signupBonus, setSignupBonus] = useState(null)

  // Surface the "first 200 users get free CC" offer for logged-out visitors
  // so they see it before bouncing off the hero. Logged-in users have already
  // claimed (or missed) the bonus so we hide it for them.
  useEffect(() => {
    if (currentUser) return
    let cancelled = false
    getSignupBonusAvailability()
      .then((res) => {
        if (cancelled) return
        if (res?.available) setSignupBonus(res)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [currentUser])

  const highlightCards = useMemo(() => {
    // Only real, live artist-published templates. No placeholder catalog.
    const live = (marketplaceTemplates || []).filter(
      (t) => !t.status || t.status === 'approved' || t.status === 'live',
    )
    return live.slice(0, 8)
  }, [marketplaceTemplates])

  const visibleCards = useMemo(() => {
    if (!showFavoritesOnly) return highlightCards
    return highlightCards.filter((card) => favorites.includes(card.id))
  }, [favorites, showFavoritesOnly, highlightCards])

  return (
    <div className="page-section">
      <ScreenHeader
        user={currentUser}
        balance={balance}
        onAuthOpen={openAuthModal}
      />

      {/* ── HERO ── */}
      <header className="topbar hero-shell">
        <div className="hero-particles" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, index) => (
            <span key={`particle-${index}`} className={`hero-particle p${index + 1}`} />
          ))}
        </div>
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow">Cardora Platform</p>
          <h1>One platform.<br />Every kind of card.</h1>
          <p className="subtext">
            Greeting reveals, live polls, scored trivia, chain replies, and anonymous inboxes —
            all designed to make the moment feel real.
          </p>
          <div className="hero-format-chips" aria-hidden="true">
            {FORMAT_CHIPS.map((chip, i) => (
              <span
                key={chip.label}
                className={`hero-format-chip ${chip.cls} fc${i + 1}`}
              >
                <span className="hfc-icon">{chip.icon}</span>
                <span className="hfc-label">{chip.label}</span>
              </span>
            ))}
          </div>
          <div className="cta-row">
            <button className="primary" type="button" onClick={() => openCardTypeModal?.()}>
              Create a Card
            </button>
            <Link className="ghost" to="/explore">
              Explore Templates
            </Link>
          </div>
          {signupBonus && !currentUser && (
            <Link to="/signup" className="hero-bonus-banner" aria-label="Claim free Cardora Credits">
              <span className="hero-bonus-icon">🎁</span>
              <span className="hero-bonus-text">
                {signupBonus.bonusAmount
                  ? <>First sign-ups get <strong>{signupBonus.bonusAmount} free CC</strong> — claim before it's gone</>
                  : (signupBonus.message || 'New accounts get free Cardora Credits — claim now')}
              </span>
              <span className="hero-bonus-arrow">→</span>
            </Link>
          )}
        </div>
        <div className="hero-preview" aria-hidden="true">
          <div className="hero-preview-orbit orbit-one" />
          <div className="hero-preview-orbit orbit-two" />
          <div className="hero-phone">
            <div className="hero-cinema-scene">
              <div className="hero-aurora" />
              <div className="hero-card-halo" />
              <div className="hero-floating-card">
                <span className="hero-fc-eyebrow">Cardora</span>
                <span className="hero-fc-title">A moment,<br />not a message.</span>
                <span className="hero-card-shimmer" />
                <span className="hero-fc-line long" />
                <span className="hero-fc-line short" />
              </div>
              {Array.from({ length: 8 }).map((_, i) => (
                <span key={`dust-${i}`} className={`hero-dust d${i + 1}`} />
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ── CARD FORMATS ── */}
      <section className="landing-section">
        <div className="section-heading">
          <p className="eyebrow">Card Formats</p>
          <h3 className="landing-title landing-title-compact">Five card formats. Five different feelings.</h3>
        </div>
        <div className="format-grid">
          {CARD_FORMATS.map((format) => (
            <article key={format.title} className={`format-card ${format.accent}`}>
              <div className="format-card-icon">{format.icon}</div>
              <h4>{format.title}</h4>
              <p className="format-card-tagline">{format.tagline}</p>
              <p className="format-card-desc">{format.description}</p>
              {format.to ? (
                <Link className="format-card-cta" to={format.to}>{format.cta} →</Link>
              ) : (
                <button className="format-card-cta" type="button" onClick={() => openCardTypeModal?.(format.typePreselect)}>
                  {format.cta} →
                </button>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="landing-section">
        <div className="section-heading">
          <p className="eyebrow">How It Works</p>
          <h3 className="landing-title">From idea to impression in four steps.</h3>
        </div>
        <div className="steps-row">
          {HOW_IT_WORKS.map((step) => (
            <article key={step.title} className="step-card">
              <span className="step-icon">{step.icon}</span>
              <h4>{step.title}</h4>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── TIERS ── */}
      <section className="landing-section">
        <div className="section-heading">
          <p className="eyebrow">Card Tiers</p>
          <h3 className="landing-title">Pick the depth of the experience.</h3>
        </div>
        <div className="tiers-grid">
          {TIERS.map((tier) => (
            <article key={tier.name} className={`tier-card ${tier.className}`}>
              <p className="tier-name">{tier.name}</p>
              <h4>{tier.label}</h4>
              <p>{tier.note}</p>
              <span className="tier-detail">{tier.details}</span>
            </article>
          ))}
        </div>
        <p className="tiers-footnote">
          Anonymous Inbox also has Classic (free) and Premium tiers for template effects.
        </p>
      </section>

      {/* ── CTA ── */}
      <section className="landing-section landing-cta">
        <p className="eyebrow">Start Here</p>
        <h3 className="landing-title">Create something unforgettable.</h3>
        <button className="primary" type="button" onClick={() => openCardTypeModal?.()}>
          Start Creating
        </button>
      </section>

      {/* ── MARKETPLACE HIGHLIGHTS ── */}
      <div className="page-body">
        <div className="screen-body">
          <div className="section-heading inline">
            <div>
              <p className="eyebrow">Marketplace Highlights</p>
              <h3 className="landing-title">Explore experiences people are already saving.</h3>
            </div>
            <button
              type="button"
              className={`icon-button section-favorite-toggle ${showFavoritesOnly ? 'favorite-active' : ''}`}
              aria-label="Show favorite templates"
              aria-pressed={showFavoritesOnly}
              onClick={() => setShowFavoritesOnly((prev) => !prev)}
            >
              <svg className="heart" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 20.5s-6.7-4.6-9.2-8.3C.7 9.3 2 6.1 4.9 5.2c2-.6 4.1.2 5.1 1.9 1-1.7 3.2-2.5 5.1-1.9 2.9.9 4.2 4.1 2.1 7-2.5 3.7-9.2 8.3-9.2 8.3z" />
              </svg>
            </button>
          </div>
          {visibleCards.length ? (
            <div className="card-grid home-template-rail">
              {visibleCards.map((card, index) => (
                <CardItem
                  key={`${card.title}-${index}`}
                  {...card}
                  showOccasion={false}
                  variant={`v${(index % 4) + 1}`}
                  isFavorite={favorites.includes(card.id)}
                  onToggleFavorite={toggleFavorite}
                  onClick={() => openCardDetails({ ...card, variant: `v${(index % 4) + 1}` })}
                />
              ))}
            </div>
          ) : (
            <p className="empty-state">No favorites saved yet.</p>
          )}
        </div>
        <ScreenNav />
      </div>
    </div>
  )
}

export default Home
