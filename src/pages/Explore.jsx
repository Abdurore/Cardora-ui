import { useEffect, useMemo, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { HiOutlineMagnifyingGlass } from 'react-icons/hi2'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import CardItem from '../components/CardItem.jsx'
import searchIcon from '../assets/icons/search.png'
import { exploreCards, exploreTags } from '../data/catalog.js'

function Explore() {
  const {
    openCardDetails,
    favorites,
    toggleFavorite,
    currentUser,
    openAuthModal,
    balance,
    marketplaceTemplates,
  } = useOutletContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [activeTag, setActiveTag] = useState(searchParams.get('tag') || 'all')
  const [tierFilter, setTierFilter] = useState('all')
  const [visibleCount, setVisibleCount] = useState(12)
  const CARDS_PER_PAGE = 12
  const cardSource = marketplaceTemplates?.length ? marketplaceTemplates : exploreCards

  const dynamicTags = useMemo(() => {
    const counts = cardSource.reduce((acc, card) => {
      const key = card.category || 'scratch'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    return exploreTags.map((tag) => {
      if (tag.value === 'all') {
        return { ...tag, count: cardSource.length }
      }
      return { ...tag, count: counts[tag.value] || 0 }
    })
  }, [cardSource])

  useEffect(() => {
    const params = {}
    if (query) params.q = query
    if (activeTag && activeTag !== 'all') params.tag = activeTag
    setSearchParams(params, { replace: true })
  }, [activeTag, query, setSearchParams])

  const filteredCards = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return cardSource
      .filter((card) => {
        const matchesQuery = normalizedQuery
          ? card.title.toLowerCase().includes(normalizedQuery)
          : true
        const matchesFavorites = activeTag === 'favorites' ? favorites.includes(card.id) : true
        const matchesTag =
          activeTag === 'all' || activeTag === 'favorites' ? true : card.category === activeTag
        const matchesTier = tierFilter === 'all' ? true : card.tier === tierFilter
        return matchesQuery && matchesTag && matchesFavorites && matchesTier
      })
  }, [activeTag, cardSource, favorites, query, tierFilter])

  useEffect(() => {
    setVisibleCount(CARDS_PER_PAGE)
  }, [activeTag, query, tierFilter])

  const pagedCards = filteredCards.slice(0, visibleCount)
  const hasMore = filteredCards.length > visibleCount

  return (
    <div className="page-body">
      <ScreenHeader user={currentUser} balance={balance} onAuthOpen={openAuthModal} />
      <div className="screen-body">
        <div className="marketplace-topbar">
          <div>
            <p className="eyebrow">Marketplace</p>
            <h2 className="marketplace-title">Find a card that already feels like a memory.</h2>
          </div>
        </div>

        <div className="search">
          <HiOutlineMagnifyingGlass className="search-icon" aria-hidden="true" />
          <input
            placeholder="Search templates, music, effects"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="marketplace-filters secondary">
          <button
            type="button"
            className={`filter-chip ${tierFilter === 'all' ? 'active' : ''}`}
            onClick={() => setTierFilter('all')}
          >
            All Tiers
          </button>
          <button
            type="button"
            className={`filter-chip ${tierFilter === 'simple' ? 'active' : ''}`}
            onClick={() => setTierFilter('simple')}
          >
            Classic
          </button>
          <button
            type="button"
            className={`filter-chip ${tierFilter === 'special' ? 'active' : ''}`}
            onClick={() => setTierFilter('special')}
          >
            Premium
          </button>
          <button
            type="button"
            className={`filter-chip ${tierFilter === 'signature' ? 'active' : ''}`}
            onClick={() => setTierFilter('signature')}
          >
            Elite
          </button>
        </div>

        <div className="tag-list">
          <button
            className={`tag ${activeTag === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveTag('favorites')}
          >
            Favorites <span>({favorites.length})</span>
          </button>
          {dynamicTags.map((tag) => (
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
          <>
            <div className="card-grid compact marketplace-grid">
              {pagedCards.map((card, index) => (
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
            {hasMore ? (
              <div className="explore-load-more">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setVisibleCount((prev) => prev + CARDS_PER_PAGE)}
                >
                  Load More ({filteredCards.length - visibleCount} remaining)
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <p className="empty-state">No cards match that search yet.</p>
        )}
      </div>
      <ScreenNav />
    </div>
  )
}

export default Explore


