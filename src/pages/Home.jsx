import { Link, useOutletContext } from 'react-router-dom'
import { useMemo, useState } from 'react'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import CardItem from '../components/CardItem.jsx'
import { exploreTags, homeCards } from '../data/catalog.js'

function Home() {
  const { openCardDetails, favorites, toggleFavorite, currentUser, openAuthModal } =
    useOutletContext()
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState('all')

  const visibleCards = useMemo(() => {
    let cards = homeCards
    if (activeSuggestion !== 'all') {
      cards = cards.filter((card) => card.category === activeSuggestion)
    }
    if (!showFavoritesOnly) return cards
    return cards.filter((card) => favorites.includes(card.id))
  }, [activeSuggestion, favorites, showFavoritesOnly])

  return (
    <div className="page-section">
      <h2 className="page-title">Cardora</h2>
      <ScreenHeader
        favoriteActive={showFavoritesOnly}
        onFavoriteToggle={() => setShowFavoritesOnly((prev) => !prev)}
        user={currentUser}
        onAuthOpen={openAuthModal}
      />
      <header className="topbar">
        <div>
          <p className="eyebrow">Cardora Web</p>
          <h1>Send stunning cards to people you love</h1>
          <p className="subtext">
            A neon-lit card marketplace for birthdays, proposals, anniversaries, and
            every tiny moment that deserves a spark.
          </p>
        </div>
        <div className="cta-row">
          <button className="primary">Start a card</button>
          <Link className="ghost" to="/explore">
            Browse templates
          </Link>
        </div>
      </header>

      <div className="pill-row">
        <button
          type="button"
          className={`pill ${activeSuggestion === 'all' ? 'active' : ''}`}
          onClick={() => setActiveSuggestion('all')}
        >
          All
        </button>
        {exploreTags
          .filter((tag) => tag.value !== 'all')
          .map((tag) => (
            <button
              key={tag.value}
              type="button"
              className={`pill ${activeSuggestion === tag.value ? 'active' : ''}`}
              onClick={() => setActiveSuggestion(tag.value)}
            >
              {tag.label}
            </button>
          ))}
      </div>

      <div className="page-body">
        <div className="screen-body">
          {visibleCards.length ? (
            <div className="card-grid">
              {visibleCards.map((card, index) => (
                <CardItem
                  key={`${card.title}-${index}`}
                  {...card}
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
