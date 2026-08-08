import { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext, useSearchParams, Link } from 'react-router-dom'
import { HiOutlineMagnifyingGlass, HiOutlineFire } from 'react-icons/hi2'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import CardItem from '../components/CardItem.jsx'
import { getPopularTemplates } from '../lib/api.js'
import { mapTemplateToCard } from '../lib/backendMappers.js'

function Explore() {
  const {
    openCardDetails,
    favorites,
    likedTemplates,
    toggleLike,
    currentUser,
    openAuthModal,
    balance,
    marketplaceTemplates,
    authReady,
  } = useOutletContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [activeTag, setActiveTag] = useState(searchParams.get('tag') || 'all')
  const [activeType, setActiveType] = useState(searchParams.get('type') || 'all')
  const [activeOccasion, setActiveOccasion] = useState(searchParams.get('occasion') || 'all')
  const [visibleCount, setVisibleCount] = useState(12)
  const [trendingTemplates, setTrendingTemplates] = useState([])
  const CARDS_PER_PAGE = 12
  // Only show real, live artist-published templates. No catalog placeholders.
  const cardSource = (marketplaceTemplates || []).filter(
    (t) => !t.status || t.status === 'approved' || t.status === 'live',
  )

  useEffect(() => {
    getPopularTemplates('days=7&page=1&limit=8')
      .then((res) => {
        const items = res?.templates || res?.data?.templates || []
        if (items.length) setTrendingTemplates(items.map(mapTemplateToCard))
      })
      .catch(() => {})
  }, [])

  // `toggleLike` (in MainLayout) only patches `marketplaceTemplates` and
  // `selectedCard` — it has no way to reach this component's own
  // `trendingTemplates` list. Rather than duplicate its optimistic-update /
  // error-rollback logic here, mirror off the canonical `likedTemplates`
  // array itself: it already reflects both the optimistic flip and any
  // revert-on-failure, so reacting to its transitions keeps the trending
  // rail's counts correct without a second source of truth.
  const prevLikedRef = useRef(likedTemplates)
  // `likedTemplates` starts as [] and is populated asynchronously once session
  // hydration resolves (MainLayout.jsx) — that first population is not a user
  // action and must not be diffed as one, or every already-liked trending card
  // gets its already-correct, freshly-fetched count bumped by +1 on mount/reload.
  // Wait for `authReady` (hydration complete) before establishing the baseline.
  const baselineSetRef = useRef(false)
  useEffect(() => {
    if (!authReady) return
    if (!baselineSetRef.current) {
      baselineSetRef.current = true
      prevLikedRef.current = likedTemplates
      return
    }
    const prevLiked = prevLikedRef.current
    if (prevLiked !== likedTemplates) {
      setTrendingTemplates((list) => list.map((card) => {
        const cardIds = [card.id, card._id].filter(Boolean).map(String)
        const wasLiked = cardIds.some((id) => prevLiked.includes(id))
        const isLiked = cardIds.some((id) => likedTemplates.includes(id))
        if (wasLiked === isLiked) return card
        const current = Number(card.likeCount ?? card.likesCount ?? card.likes ?? 0) || 0
        const next = Math.max(0, current + (isLiked ? 1 : -1))
        return { ...card, likeCount: next, likes: String(next) }
      }))
      prevLikedRef.current = likedTemplates
    }
  }, [likedTemplates, authReady])

  useEffect(() => {
    const params = {}
    if (query) params.q = query
    if (activeTag && activeTag !== 'all') params.tag = activeTag
    if (activeType && activeType !== 'all') params.type = activeType
    if (activeOccasion && activeOccasion !== 'all') params.occasion = activeOccasion
    setSearchParams(params, { replace: true })
  }, [activeTag, activeType, activeOccasion, query, setSearchParams])

  const occasions = useMemo(() => {
    const seen = new Set()
    cardSource.forEach(c => {
      const occ = (c.category || c.occasion || '').trim()
      if (occ) seen.add(occ)
    })
    return Array.from(seen).sort()
  }, [cardSource])

  const filteredCards = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return cardSource.filter((card) => {
      const matchesQuery = normalizedQuery
        ? card.title.toLowerCase().includes(normalizedQuery)
          || (card.category || '').toLowerCase().includes(normalizedQuery)
          || (card.occasion || '').toLowerCase().includes(normalizedQuery)
        : true
      const matchesFavorites = activeTag === 'favorites' ? favorites.includes(card.id) : true
      const cardType = (card.type || '').toLowerCase()
      const matchesType =
        activeType === 'all'
          ? true
          : activeType === 'personal'
            ? !cardType || cardType === 'personal' || cardType === 'standard' || cardType === 'moment'
            : cardType === activeType
      const cardOcc = (card.category || card.occasion || '').toLowerCase()
      const matchesOccasion = activeOccasion === 'all' ? true : cardOcc === activeOccasion.toLowerCase()
      return matchesQuery && matchesFavorites && matchesType && matchesOccasion
    })
  }, [activeTag, activeType, activeOccasion, cardSource, favorites, query])

  useEffect(() => {
    setVisibleCount(CARDS_PER_PAGE)
  }, [activeTag, activeType, activeOccasion, query])

  const pagedCards = filteredCards.slice(0, visibleCount)
  const hasMore = filteredCards.length > visibleCount

  const cardTypes = [
    { id: 'all', label: 'All' },
    { id: 'personal', label: 'Personal' },
    { id: 'poll', label: 'Poll' },
    { id: 'trivia', label: 'Trivia' },
    { id: 'chain', label: 'Chain' },
    { id: 'anonymous', label: 'Anonymous' },
  ]

  return (
    <div className="page-body">
      <ScreenHeader user={currentUser} balance={balance} onAuthOpen={openAuthModal} />
      <div className="screen-body">
        <div className="marketplace-topbar">
          <div>
            <p className="eyebrow">Marketplace</p>
            <h2 className="marketplace-title">Find a card that already feels like a memory.</h2>
          </div>
          <Link to="/artists" className="marketplace-artists-link">Meet the Artists →</Link>
        </div>

        <div className="search">
          <HiOutlineMagnifyingGlass className="search-icon" aria-hidden="true" />
          <input
            placeholder="Search templates, occasions, effects"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        {/* Trending rail */}
        {trendingTemplates.length > 0 && !query && activeTag === 'all' && activeType === 'all' ? (
          <div className="explore-trending">
            <p className="explore-trending-label">
              <HiOutlineFire aria-hidden="true" /> Trending this week
            </p>
            <div className="explore-trending-rail">
              {trendingTemplates.map((card, index) => (
                <CardItem
                  key={`trending-${card.id}-${index}`}
                  {...card}
                  variant={`v${(index % 4) + 1}`}
                  isLiked={likedTemplates.includes(card.id)}
                  onToggleLike={toggleLike}
                  onClick={() => openCardDetails({ ...card, variant: `v${(index % 4) + 1}` })}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* Card type filter */}
        <div className="tag-list explore-type-filter">
          {cardTypes.map(({ id, label }) => (
            <button
              key={id}
              className={`tag ${activeType === id ? 'active' : ''}`}
              onClick={() => setActiveType(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Occasion/category filter — only shown when there are occasions to filter by */}
        {occasions.length > 0 && (
          <div className="tag-list explore-occasion-filter">
            <button
              className={`tag ${activeOccasion === 'all' ? 'active' : ''}`}
              onClick={() => setActiveOccasion('all')}
            >
              All Occasions
            </button>
            {occasions.map(occ => (
              <button
                key={occ}
                className={`tag ${activeOccasion === occ ? 'active' : ''}`}
                onClick={() => setActiveOccasion(occ)}
              >
                {occ}
              </button>
            ))}
          </div>
        )}

        {/* Favorites filter row */}
        <div className="tag-list">
          <button
            className={`tag ${activeTag === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTag('all')}
          >
            All <span>({cardSource.length})</span>
          </button>
          <button
            className={`tag ${activeTag === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveTag('favorites')}
          >
            Favorites <span>({favorites.length})</span>
          </button>
        </div>

        {!authReady && cardSource.length === 0 ? (
          <div className="card-grid compact marketplace-grid" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card-grid-skeleton-item" />
            ))}
          </div>
        ) : filteredCards.length ? (
          <>
            <div className="card-grid compact marketplace-grid">
              {pagedCards.map((card, index) => (
                <CardItem
                  key={card.id || card.templateId || `${card.title}-${index}`}
                  {...card}
                  variant={`v${(index % 4) + 1}`}
                  isLiked={likedTemplates.includes(card.id)}
                  onToggleLike={toggleLike}
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
          <p className="empty-state">
            {cardSource.length === 0
              ? 'The marketplace is waiting for its first templates. Check back soon.'
              : 'No cards match that search yet.'}
          </p>
        )}
      </div>
      <ScreenNav />
    </div>
  )
}

export default Explore
