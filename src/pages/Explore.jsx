import { useEffect, useMemo, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import CardItem from '../components/CardItem.jsx'
import searchIcon from '../assets/icons/search.png'
import { exploreCards, exploreTags } from '../data/catalog.js'

function Explore() {
  const { openCardDetails, favorites, toggleFavorite, currentUser, openAuthModal, balance } =
    useOutletContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [activeTag, setActiveTag] = useState(searchParams.get('tag') || 'all')

  useEffect(() => {
    const params = {}
    if (query) params.q = query
    if (activeTag && activeTag !== 'all') params.tag = activeTag
    setSearchParams(params, { replace: true })
  }, [activeTag, query, setSearchParams])

  const filteredCards = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return exploreCards
      .filter((card) => {
        const matchesQuery = normalizedQuery
          ? card.title.toLowerCase().includes(normalizedQuery)
          : true
        const matchesFavorites = activeTag === 'favorites' ? favorites.includes(card.id) : true
        const matchesTag =
          activeTag === 'all' || activeTag === 'favorites' ? true : card.category === activeTag
        return matchesQuery && matchesTag && matchesFavorites
      })
      .filter((card) => (activeTag === 'favorites' ? favorites.includes(card.id) : true))
  }, [activeTag, query, favorites])

  return (
    <div className="page-body">
      <ScreenHeader user={currentUser} balance={balance} onAuthOpen={openAuthModal} />
      <div className="screen-body">
        <div className="search">
          <img className="search-icon" src={searchIcon} alt="" aria-hidden="true" />
          <input
            placeholder="Search templates, music, effects"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="tag-list">
          <button
            className={`tag ${activeTag === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveTag('favorites')}
          >
            Favorites <span>({favorites.length})</span>
          </button>
          {exploreTags.map((tag) => (
            <button
              key={tag.label}
              className={`tag ${activeTag === tag.value ? 'active' : ''}`}
              onClick={() => setActiveTag(tag.value)}
            >
              {tag.label} <span>({tag.count})</span>
            </button>
          ))}
        </div>
        {filteredCards.length ? (
          <div className="card-grid compact">
            {filteredCards.map((card, index) => (
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
          <p className="empty-state">No cards match that search yet.</p>
        )}
      </div>
      <ScreenNav />
    </div>
  )
}

export default Explore
