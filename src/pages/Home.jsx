import { Link, useOutletContext } from 'react-router-dom'
import { useMemo, useState } from 'react'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import CardItem from '../components/CardItem.jsx'
import { homeCards } from '../data/catalog.js'

function Home() {
  const { openCardDetails, favorites, toggleFavorite, currentUser, openAuthModal, balance } =
    useOutletContext()
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)

  const howItWorks = [
    {
      title: 'Choose a Card',
      description: 'Start with a template built for birthdays, confessions, milestones, and surprises.',
      icon: '01',
    },
    {
      title: 'Customize It',
      description: 'Tune the copy, motion, and pacing until the whole reveal feels personal.',
      icon: '02',
    },
    {
      title: 'Add Gifts',
      description: 'Layer in glow effects and premium surprises when the moment needs more impact.',
      icon: '03',
    },
    {
      title: 'Send & Surprise',
      description: 'Deliver an experience that opens like a memory instead of a notification.',
      icon: '04',
    },
  ]

  const featureCards = [
    {
      title: 'Envelope Experience',
      description: 'A cinematic open sequence with soft light and emotional pacing.',
      accent: 'warm',
    },
    {
      title: 'Music + Sound Effects',
      description: 'Ambient sound that makes the message feel intimate the moment it starts.',
      accent: 'cool',
    },
    {
      title: 'Interactive Questions',
      description: 'Add suspense, response, and playfulness inside the reveal itself.',
      accent: 'rose',
    },
    {
      title: 'Gift Animations',
      description: 'Bursts, blooms, sparkles, and premium effects that feel like a reward.',
      accent: 'mint',
    },
    {
      title: 'Multi-recipient Sending',
      description: 'Send one crafted experience to a person, a family, or a whole celebration.',
      accent: 'violet',
    },
  ]

  const tiers = [
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

  const visibleCards = useMemo(() => {
    if (!showFavoritesOnly) return homeCards
    return homeCards.filter((card) => favorites.includes(card.id))
  }, [favorites, showFavoritesOnly])

  return (
    <div className="page-section">
      <ScreenHeader
        user={currentUser}
        balance={balance}
        onAuthOpen={openAuthModal}
      />

      <header className="topbar hero-shell">
        <div className="hero-particles" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, index) => (
            <span key={`particle-${index}`} className={`hero-particle p${index + 1}`} />
          ))}
        </div>
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow">Cardora Experience</p>
          <h1>Don&apos;t just send a message. Create a moment.</h1>
          <p className="subtext">
            Interactive cards with music, animations, and emotion. Build a reveal that
            feels cinematic from the envelope to the final glow.
          </p>
          <div className="cta-row">
            <Link className="primary" to="/studio">
              Create a Card
            </Link>
            <Link className="ghost" to="/explore">
              Explore Cards
            </Link>
          </div>
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

      <section className="landing-section">
        <div className="section-heading">
          <p className="eyebrow">How It Works</p>
          <h3 className="landing-title">Every card unfolds like a tiny film.</h3>
        </div>
        <div className="steps-row">
          {howItWorks.map((step) => (
            <article key={step.title} className="step-card">
              <span className="step-icon">{step.icon}</span>
              <h4>{step.title}</h4>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <div className="section-heading">
          <p className="eyebrow">Features</p>
          <h3 className="landing-title">Designed to feel alive the moment it opens.</h3>
        </div>
        <div className="feature-grid">
          {featureCards.map((feature) => (
            <article key={feature.title} className={`feature-card ${feature.accent}`}>
              <div className="feature-preview">
                <span className="feature-orb orb-a" />
                <span className="feature-orb orb-b" />
                <span className="feature-wave" />
              </div>
              <h4>{feature.title}</h4>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <div className="section-heading">
          <p className="eyebrow">Card Tiers</p>
          <h3 className="landing-title">Pick the depth of the experience.</h3>
        </div>
        <div className="tiers-grid">
          {tiers.map((tier) => (
            <article key={tier.name} className={`tier-card ${tier.className}`}>
              <p className="tier-name">{tier.name}</p>
              <h4>{tier.label}</h4>
              <p>{tier.note}</p>
              <span className="tier-detail">{tier.details}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-cta">
        <p className="eyebrow">Start Here</p>
        <h3 className="landing-title">Create something unforgettable.</h3>
        <Link className="primary" to="/studio">
          Start Creating
        </Link>
      </section>

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

