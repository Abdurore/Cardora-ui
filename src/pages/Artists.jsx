import { useEffect, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { HiOutlineHeart, HiOutlineSquares2X2 } from 'react-icons/hi2'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import CardItem from '../components/CardItem.jsx'
import { getArtists, getArtistById, getTemplates } from '../lib/api.js'
import { mapTemplateToCard } from '../lib/backendMappers.js'

function ArtistCard({ artist, onClick }) {
  return (
    <button type="button" className="artist-card" onClick={onClick}>
      <div className="artist-card-avatar">
        {artist.profilePictureUrl ? (
          <img src={artist.profilePictureUrl} alt={artist.username} />
        ) : (
          <span>{artist.username?.charAt(0)?.toUpperCase() || '?'}</span>
        )}
      </div>
      <h4 className="artist-card-name">{artist.username}</h4>
      {artist.bio && <p className="artist-card-bio">{artist.bio}</p>}
      <div className="artist-card-stats">
        <span><HiOutlineSquares2X2 aria-hidden="true" /> {artist.templateCount} templates</span>
        <span><HiOutlineHeart aria-hidden="true" /> {artist.totalLikes} likes</span>
      </div>
    </button>
  )
}

function Artists() {
  const {
    openCardDetails, likedTemplates, toggleLike,
    currentUser, openAuthModal, balance,
  } = useOutletContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const [artists, setArtists] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeArtist, setActiveArtist] = useState(null)
  const [artistTemplates, setArtistTemplates] = useState([])
  const [loadingArtistTemplates, setLoadingArtistTemplates] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getArtists('page=1&limit=50')
      .then((res) => {
        if (cancelled) return
        setArtists(res?.artists || res?.data?.artists || [])
      })
      .catch(() => { if (!cancelled) setArtists([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Deep-link support: /artists?id=<artistId>
  useEffect(() => {
    const id = searchParams.get('id')
    if (id && !activeArtist) {
      getArtistById(id).then((res) => {
        const artist = res?.artist || res?.data?.artist
        if (artist) setActiveArtist(artist)
      }).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!activeArtist) {
      setArtistTemplates([])
      return
    }
    let cancelled = false
    setLoadingArtistTemplates(true)
    getTemplates(`artist=${encodeURIComponent(activeArtist.id)}&limit=100`)
      .then((res) => {
        if (cancelled) return
        const raw = res?.templates || res?.data?.templates || []
        setArtistTemplates(raw.map(mapTemplateToCard))
      })
      .catch(() => { if (!cancelled) setArtistTemplates([]) })
      .finally(() => { if (!cancelled) setLoadingArtistTemplates(false) })
    return () => { cancelled = true }
  }, [activeArtist])

  const openArtist = (artist) => {
    setActiveArtist(artist)
    setSearchParams({ id: artist.id }, { replace: true })
  }

  const backToDirectory = () => {
    setActiveArtist(null)
    setSearchParams({}, { replace: true })
  }

  return (
    <div className="page-body">
      <ScreenHeader user={currentUser} balance={balance} onAuthOpen={openAuthModal} />
      <div className="screen-body">
        {!activeArtist ? (
          <>
            <div className="marketplace-topbar">
              <div>
                <p className="eyebrow">Marketplace</p>
                <h2 className="marketplace-title">Meet the artists behind Cardora's templates.</h2>
              </div>
            </div>

            {loading ? (
              <div className="artists-loading"><div className="chat-loading-spinner" /></div>
            ) : artists.length === 0 ? (
              <div className="store-frame-empty">No artists have published templates yet.</div>
            ) : (
              <div className="artists-grid">
                {artists.map((artist) => (
                  <ArtistCard key={artist.id} artist={artist} onClick={() => openArtist(artist)} />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <button type="button" className="artist-back-btn" onClick={backToDirectory}>
              ← All Artists
            </button>
            <div className="artist-profile-header">
              <div className="artist-card-avatar large">
                {activeArtist.profilePictureUrl ? (
                  <img src={activeArtist.profilePictureUrl} alt={activeArtist.username} />
                ) : (
                  <span>{activeArtist.username?.charAt(0)?.toUpperCase() || '?'}</span>
                )}
              </div>
              <div>
                <h2 className="marketplace-title">{activeArtist.username}</h2>
                {activeArtist.bio && <p className="artist-profile-bio">{activeArtist.bio}</p>}
                <div className="artist-card-stats">
                  <span><HiOutlineSquares2X2 aria-hidden="true" /> {activeArtist.templateCount} templates</span>
                  <span><HiOutlineHeart aria-hidden="true" /> {activeArtist.totalLikes} likes</span>
                </div>
              </div>
            </div>

            {loadingArtistTemplates ? (
              <div className="artists-loading"><div className="chat-loading-spinner" /></div>
            ) : artistTemplates.length === 0 ? (
              <div className="store-frame-empty">This artist hasn't published any templates yet.</div>
            ) : (
              <div className="card-grid compact marketplace-grid">
                {artistTemplates.map((card, index) => (
                  <CardItem
                    key={card.id}
                    {...card}
                    variant={`v${(index % 4) + 1}`}
                    isLiked={likedTemplates.includes(card.id)}
                    onToggleLike={toggleLike}
                    onClick={() => openCardDetails({ ...card, variant: `v${(index % 4) + 1}` })}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <ScreenNav />
    </div>
  )
}

export default Artists
