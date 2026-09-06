import { useOutletContext, useNavigate, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import CardItem from '../components/CardItem.jsx'
import StatusModal from '../components/StatusModal.jsx'
import { useAppConfirm } from '../hooks/useAppConfirm.jsx'
import { getMyTemplates } from '../lib/api.js'
import { mapTemplateToCard } from '../lib/backendMappers.js'

const TABS = ['Overview', 'Templates', 'Earnings']

function pickList(payload, ...keys) {
  const root = payload?.data ?? payload
  for (const key of keys) {
    if (Array.isArray(root?.[key])) return root[key]
  }
  return Array.isArray(root) ? root : []
}

function ArtistDashboard() {
  const {
    currentUser, balance, openAuthModal,
    likedTemplates, toggleLike, openCardDetails,
    deleteMarketplaceTemplate, authReady,
  } = useOutletContext()
  const navigate = useNavigate()
  const { confirm: appConfirm, ConfirmModal } = useAppConfirm()
  const [statusModal, setStatusModal] = useState(null)
  const [activeTab, setActiveTab] = useState('Overview')
  const [loading, setLoading] = useState(false)
  const [templates, setTemplates] = useState(null) // null = not loaded yet

  const isArtist = String(currentUser?.role || '').toLowerCase() === 'artist'

  useEffect(() => {
    setTemplates(null)
    if (!isArtist || !currentUser?.id) return
    let cancelled = false
    setLoading(true)
    getMyTemplates(currentUser.id)
      .then((res) => {
        if (cancelled) return
        const raw = pickList(res, 'templates', 'items', 'docs', 'results')
        setTemplates(raw.map((t, i) => mapTemplateToCard(t, i)))
      })
      .catch(() => { if (!cancelled) setTemplates([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isArtist, currentUser?.id])

  const showMsg = (text, ok = true) => setStatusModal({ type: ok ? 'success' : 'error', message: text })

  const templateList = templates || []
  const totalLikes = templateList.reduce((sum, t) => sum + (Number(t.likeCount) || 0), 0)
  const totalViews = templateList.reduce((sum, t) => sum + (Number(t.viewCount) || 0), 0)
  const totalUses = templateList.reduce((sum, t) => sum + (Number(t.usageCount) || 0), 0)

  const handleEditDesign = (card) => {
    const type = card.type || 'personal'
    const tier = card.tier || 'classic'
    navigate(`/studio?type=${type}&tier=${tier}`, {
      state: { cardData: card, editTemplateId: card.templateId || card.id },
    })
  }

  const handleDelete = async (card) => {
    if (!await appConfirm('Delete Template', `Delete "${card.title}"? This cannot be undone.`, { variant: 'danger', confirmLabel: 'Delete' })) return
    const res = await deleteMarketplaceTemplate?.(card.templateId || card.id)
    if (res?.ok) {
      setTemplates((prev) => (prev || []).filter((t) => (t.templateId || t.id) !== (card.templateId || card.id)))
      showMsg('Template deleted.')
    } else {
      showMsg(res?.message || 'Delete failed.', false)
    }
  }

  // 7.16: `currentUser` starts null until MainLayout's session hydration
  // resolves -- without this, a direct load/refresh of /artist flashed
  // "Access Restricted" at a real artist before the role was known.
  if (!authReady) {
    return (
      <div className="page-body">
        <ScreenHeader user={currentUser} balance={balance} onAuthOpen={openAuthModal} />
        <div className="screen-body">
          <div className="admin-restricted">
            <h2>Loading…</h2>
          </div>
        </div>
        <ScreenNav />
      </div>
    )
  }

  if (!isArtist) {
    return (
      <div className="page-body">
        <ScreenHeader user={currentUser} balance={balance} onAuthOpen={openAuthModal} />
        <div className="screen-body">
          <div className="admin-restricted">
            <h2>Access Restricted</h2>
            <p>This dashboard is only available to Artist accounts.</p>
            <button className="primary" type="button" onClick={() => navigate('/')}>Go Home</button>
          </div>
        </div>
        <ScreenNav />
      </div>
    )
  }

  return (
    <div className="page-body">
      <ScreenHeader user={currentUser} balance={balance} onAuthOpen={openAuthModal} />
      <div className="screen-body">
        <div className="admin-header">
          <p className="eyebrow">Artist Studio</p>
          <h2>Artist Dashboard</h2>
        </div>

        <div className="admin-tabs">
          {TABS.map(tab => (
            <button
              key={tab}
              type="button"
              className={`admin-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading && (
          <div className="profile-cards-loading">
            <div className="chat-loading-spinner" />
            <p>Loading…</p>
          </div>
        )}

        {activeTab === 'Overview' && !loading && (
          <div className="admin-section">
            <h3 className="admin-section-title">Your Performance</h3>
            <div className="admin-stats-grid">
              <div className="admin-stat-card">
                <div className="admin-stat-value">{templateList.length}</div>
                <div className="admin-stat-label">Templates Published</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-value">{totalLikes}</div>
                <div className="admin-stat-label">Total Likes</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-value">{totalViews}</div>
                <div className="admin-stat-label">Total Views</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-value">{totalUses}</div>
                <div className="admin-stat-label">Total Uses</div>
              </div>
            </div>
            <p className="admin-section-note" style={{ marginTop: 16 }}>
              Want to design something new? Head to the <Link to="/">Home page</Link> and pick a card format — every tier is unlocked for you.
            </p>
          </div>
        )}

        {activeTab === 'Templates' && !loading && (
          <div className="admin-section">
            <h3 className="admin-section-title">Published Templates {templateList.length > 0 && `(${templateList.length})`}</h3>
            {templateList.length > 0 ? (
              <div className="card-grid compact">
                {templateList.map((card, index) => (
                  <div key={card.id} className="profile-card-wrap">
                    <CardItem
                      {...card}
                      variant={`v${(index % 4) + 1}`}
                      isLiked={likedTemplates.includes(card.id)}
                      onToggleLike={toggleLike}
                      onClick={() => openCardDetails({ ...card, variant: `v${(index % 4) + 1}` })}
                    />
                    <div className="profile-template-analytics">
                      <span className={`profile-template-status profile-template-status-${(card.status || 'approved')}`}>
                        {card.tag || 'Live'}
                      </span>
                      <span className="profile-template-stat"><strong>{card.viewCount ?? 0}</strong> views</span>
                      <span className="profile-template-stat"><strong>{card.likeCount ?? 0}</strong> likes</span>
                      <span className="profile-template-stat"><strong>{card.usageCount ?? 0}</strong> uses</span>
                    </div>
                    <div className="profile-card-actions profile-template-actions">
                      <button type="button" className="profile-card-action-btn design" onClick={(e) => { e.stopPropagation(); handleEditDesign(card) }} title="Edit design" aria-label="Edit design">
                        <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="14" height="14" rx="2" />
                          <path d="M3 13l3.5-3.5a1.5 1.5 0 0 1 2 0L11 12l2-2a1.5 1.5 0 0 1 2 0L17 12" />
                        </svg>
                      </button>
                      <button type="button" className="profile-card-action-btn delete" onClick={(e) => { e.stopPropagation(); handleDelete(card) }} title="Delete template" aria-label="Delete template">
                        <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h14M8 6V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2M6 6l1 11a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2l1-11" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">You haven't published any templates yet. Create one and click Publish in Studio.</p>
            )}
          </div>
        )}

        {activeTab === 'Earnings' && !loading && (
          <div className="admin-section">
            <h3 className="admin-section-title">Earnings</h3>
            <p className="admin-section-note">Earnings tracking for published templates is coming soon.</p>
          </div>
        )}
      </div>
      <ScreenNav />
      {ConfirmModal}
      {statusModal && (
        <StatusModal type={statusModal.type} message={statusModal.message} onClose={() => setStatusModal(null)} />
      )}
    </div>
  )
}

export default ArtistDashboard
