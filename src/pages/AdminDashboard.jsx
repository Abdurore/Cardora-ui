import { useOutletContext, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { uploadToCloudinary } from '../lib/cloudinary.js'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import Dropdown from '../components/Dropdown.jsx'
import {
  getAdminDashboard,
  getAdminStatsUsers,
  getAdminStatsCards,
  getAdminStatsTemplates,
  getAdminStatsOverview,
  getAdminUsers,
  getAdminArtistApplications,
  acceptArtistApplication,
  banUser,
  getAdminPackages,
  createAdminPackage,
  deleteAdminPackage,
  getAdminRedeemCodes,
  createAdminRedeemCode,
  getAdminAds,
  createAdminAd,
  updateAdminAd,
  getAdminAdsAnalytics,
  getAdminActionLogs,
  sendSeasonalReminder,
  updateAdminPackage,
  getAdminStatsReferrals,
  getAdminCoupons,
  sendAdminBroadcast,
  getMediaVideos,
  uploadMediaVideo,
  deleteMediaVideo,
  getMediaMusic,
  uploadMediaMusic,
  deleteMediaMusic,
} from '../lib/api.js'

const TABS = ['Overview', 'Users', 'Templates', 'Artists', 'Packages', 'Codes', 'Ads', 'Media', 'Coupons', 'Logs']

function pickStatValue(...values) {
  for (const value of values) {
    if (value === 0) return 0
    if (value !== undefined && value !== null && value !== '') return value
  }
  return '-'
}

function normalizeOverviewStats(overview, dashboard, usersStats, cardsStats, templatesStats) {
  const overviewData = overview?.data || overview || {}
  const dashboardData = dashboard?.data || dashboard || {}
  const dashboardStats = dashboardData?.stats || dashboardData?.overview || dashboardData?.metrics || {}
  const userStats = usersStats?.data || usersStats || {}
  const cardStats = cardsStats?.data || cardsStats || {}
  const templateStats = templatesStats?.data || templatesStats || {}

  return {
    totalUsers: pickStatValue(
      overviewData.totalUsers,
      overviewData.users,
      overviewData.total_users,
      dashboardStats.totalUsers,
      dashboardStats.users,
      dashboardData.totalUsers,
      dashboardData.users,
      userStats.totalUsers,
      userStats.users,
      userStats.total,
      userStats.count,
    ),
    totalCards: pickStatValue(
      overviewData.totalCards,
      overviewData.cards,
      overviewData.total_cards,
      dashboardStats.totalCards,
      dashboardStats.cards,
      dashboardData.totalCards,
      dashboardData.cards,
      cardStats.totalCards,
      cardStats.cards,
      cardStats.total,
      cardStats.count,
    ),
    totalTemplates: pickStatValue(
      overviewData.totalTemplates,
      overviewData.templates,
      overviewData.total_templates,
      dashboardStats.totalTemplates,
      dashboardStats.templates,
      dashboardData.totalTemplates,
      dashboardData.templates,
      templateStats.totalTemplates,
      templateStats.templates,
      templateStats.total,
      templateStats.count,
    ),
    totalRevenue: pickStatValue(
      overviewData.totalRevenue,
      overviewData.revenue,
      overviewData.total_revenue,
      dashboardStats.totalRevenue,
      dashboardStats.revenue,
      dashboardData.totalRevenue,
      dashboardData.revenue,
    ),
  }
}

function AdminDashboard() {
  const { currentUser, balance, openAuthModal, marketplaceTemplates, deleteMarketplaceTemplate } = useOutletContext()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('Overview')
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [applications, setApplications] = useState([])
  const [packages, setPackages] = useState([])
  const [redeemCodes, setRedeemCodes] = useState([])
  const [ads, setAds] = useState([])
  const [adsAnalytics, setAdsAnalytics] = useState(null)
  const [logs, setLogs] = useState([])
  const [coupons, setCoupons] = useState([])
  const [referralStats, setReferralStats] = useState(null)
  const [mediaVideos, setMediaVideos] = useState([])
  const [mediaMusic, setMediaMusic] = useState([])
  const [loading, setLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState({ text: '', ok: false })

  // New package form
  const [newPkg, setNewPkg] = useState({ name: '', description: '', numberOfCC: 20, price: 9.99, isActive: true, featured: false })
  // New redeem code form
  const [newCode, setNewCode] = useState({ numberOfCC: 10, maxUses: 200, isActive: true })
  // New ad form
  const [newAd, setNewAd] = useState({ name: '', type: 'external', videoUrl: '', rewardCC: 2, duration: 30, isActive: true, priority: 1 })
  const [adVideoUploading, setAdVideoUploading] = useState(false)
  const [adVideoDragOver, setAdVideoDragOver] = useState(false)
  const adVideoInputRef = useRef(null)
  // Media library forms
  const [newVideo, setNewVideo] = useState({ name: '', url: '' })
  const [newTrack, setNewTrack] = useState({ name: '', url: '' })
  const [mediaVideoUploading, setMediaVideoUploading] = useState(false)
  const [mediaMusicUploading, setMediaMusicUploading] = useState(false)
  const mediaVideoInputRef = useRef(null)
  const mediaMusicInputRef = useRef(null)
  // Ban form
  const [banForm, setBanForm] = useState({ userId: '', durationDays: 7, reason: '' })
  // Broadcast message
  const [broadcastMessage, setBroadcastMessage] = useState('')

  // Gate: only Admin role
  if (!currentUser || currentUser.role !== 'Admin') {
    return (
      <div className="page-body">
        <ScreenHeader user={currentUser} balance={balance} onAuthOpen={openAuthModal} />
        <div className="screen-body">
          <div className="admin-restricted">
            <h2>Access Restricted</h2>
            <p>This dashboard is only available to Admin users.</p>
            <button className="primary" type="button" onClick={() => navigate('/')}>Go Home</button>
          </div>
        </div>
        <ScreenNav />
      </div>
    )
  }

  const showMsg = (text, ok = true) => {
    setActionMsg({ text, ok })
    setTimeout(() => setActionMsg({ text: '', ok: false }), 3000)
  }

  const loadTabData = async (tab) => {
    setLoading(true)
    try {
      switch (tab) {
        case 'Overview': {
          const [overviewRes, dashboardRes, usersStatsRes, cardsStatsRes, templatesStatsRes, referralRes] = await Promise.allSettled([
            getAdminStatsOverview(),
            getAdminDashboard(),
            getAdminStatsUsers(),
            getAdminStatsCards(),
            getAdminStatsTemplates(),
            getAdminStatsReferrals(),
          ])

          setStats(
            normalizeOverviewStats(
              overviewRes.status === 'fulfilled' ? overviewRes.value : null,
              dashboardRes.status === 'fulfilled' ? dashboardRes.value : null,
              usersStatsRes.status === 'fulfilled' ? usersStatsRes.value : null,
              cardsStatsRes.status === 'fulfilled' ? cardsStatsRes.value : null,
              templatesStatsRes.status === 'fulfilled' ? templatesStatsRes.value : null,
            ),
          )
          if (referralRes.status === 'fulfilled') {
            setReferralStats(referralRes.value?.data || referralRes.value || null)
          }
          break
        }
        case 'Coupons': {
          const res = await getAdminCoupons()
          setCoupons(res?.data?.coupons || res?.coupons || [])
          break
        }
        case 'Users': {
          const res = await getAdminUsers()
          setUsers(res?.data?.users || res?.users || [])
          break
        }
        case 'Templates': {
          // Templates are already loaded into marketplaceTemplates via outlet context.
          break
        }
        case 'Artists': {
          const res = await getAdminArtistApplications()
          setApplications(res?.data?.applications || res?.applications || [])
          break
        }
        case 'Packages': {
          const res = await getAdminPackages()
          setPackages(res?.data?.packages || res?.packages || [])
          break
        }
        case 'Codes': {
          const res = await getAdminRedeemCodes()
          setRedeemCodes(res?.data?.codes || res?.codes || res?.data?.redeemCodes || res?.redeemCodes || [])
          break
        }
        case 'Ads': {
          const [adsRes, analyticsRes] = await Promise.allSettled([getAdminAds(), getAdminAdsAnalytics()])
          if (adsRes.status === 'fulfilled') setAds(adsRes.value?.data?.ads || adsRes.value?.ads || [])
          if (analyticsRes.status === 'fulfilled') setAdsAnalytics(analyticsRes.value?.data || analyticsRes.value || null)
          break
        }
        case 'Media': {
          const [videosRes, musicRes] = await Promise.allSettled([getMediaVideos(), getMediaMusic()])
          if (videosRes.status === 'fulfilled') setMediaVideos(videosRes.value?.data?.videos || videosRes.value?.videos || [])
          if (musicRes.status === 'fulfilled') setMediaMusic(musicRes.value?.data?.music || musicRes.value?.music || [])
          break
        }
        case 'Logs': {
          const res = await getAdminActionLogs()
          setLogs(res?.data?.logs || res?.logs || [])
          break
        }
      }
    } catch (err) {
      console.error(`Admin ${tab} load failed`, err)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadTabData(activeTab)
  }, [activeTab])

  const handleAcceptApplication = async (appId) => {
    try {
      await acceptArtistApplication(appId)
      showMsg('Application accepted!')
      loadTabData('Templates')
    } catch (err) {
      showMsg(err.message || 'Failed', false)
    }
  }

  const handleBanUser = async () => {
    if (!banForm.userId) { showMsg('User ID required', false); return }
    try {
      await banUser(banForm)
      showMsg('User banned.')
      setBanForm({ userId: '', durationDays: 7, reason: '' })
      loadTabData('Users')
    } catch (err) {
      showMsg(err.message || 'Ban failed', false)
    }
  }

  const handleCreatePackage = async () => {
    if (!newPkg.name) { showMsg('Package name required', false); return }
    try {
      await createAdminPackage(newPkg)
      showMsg('Package created!')
      setNewPkg({ name: '', description: '', numberOfCC: 20, price: 9.99, isActive: true, featured: false })
      loadTabData('Packages')
    } catch (err) {
      showMsg(err.message || 'Failed', false)
    }
  }

  const handleTogglePackage = async (pkg) => {
    const id = pkg.packageId || pkg._id
    try {
      await updateAdminPackage(id, { isActive: !pkg.isActive })
      showMsg(pkg.isActive ? 'Package deactivated.' : 'Package activated.')
      loadTabData('Packages')
    } catch (err) {
      showMsg(err.message || 'Update failed', false)
    }
  }

  const handleToggleAd = async (ad) => {
    const id = ad._id || ad.id
    try {
      await updateAdminAd(id, { isActive: !ad.isActive })
      showMsg(ad.isActive ? 'Ad deactivated.' : 'Ad activated.')
      loadTabData('Ads')
    } catch (err) {
      showMsg(err.message || 'Update failed', false)
    }
  }

  const handleDeletePackage = async (pkgId) => {
    try {
      await deleteAdminPackage(pkgId)
      showMsg('Package deleted.')
      loadTabData('Packages')
    } catch (err) {
      showMsg(err.message || 'Failed', false)
    }
  }

  const handleCreateCode = async () => {
    try {
      await createAdminRedeemCode(newCode)
      showMsg('Redeem code created!')
      loadTabData('Codes')
    } catch (err) {
      showMsg(err.message || 'Failed', false)
    }
  }

  const handleAdVideoFile = async (file) => {
    if (!file) return
    if (!file.type.startsWith('video/')) {
      showMsg('Please select a video file.', false)
      return
    }
    setAdVideoUploading(true)
    try {
      const url = await uploadToCloudinary(file, 'video')
      setNewAd(p => ({ ...p, videoUrl: url }))
      showMsg('Video uploaded successfully!')
    } catch (err) {
      showMsg(err.message || 'Video upload failed.', false)
    } finally {
      setAdVideoUploading(false)
    }
  }

  const handleCreateAd = async () => {
    if (!newAd.videoUrl) { showMsg('Video URL required — please upload a video.', false); return }
    try {
      await createAdminAd(newAd)
      showMsg('Ad created!')
      setNewAd({ name: '', type: 'external', videoUrl: '', rewardCC: 2, duration: 30, isActive: true, priority: 1 })
      if (adVideoInputRef.current) adVideoInputRef.current.value = ''
      loadTabData('Ads')
    } catch (err) {
      showMsg(err.message || 'Failed', false)
    }
  }

  const handleBroadcast = async () => {
    if (!broadcastMessage.trim()) { showMsg('Message cannot be empty.', false); return }
    try {
      await sendAdminBroadcast({ message: broadcastMessage.trim() })
      showMsg('Broadcast sent to all users!')
      setBroadcastMessage('')
    } catch (err) {
      showMsg(err.message || 'Failed', false)
    }
  }

  const handleMediaVideoFile = async (file) => {
    if (!file || !file.type.startsWith('video/')) { showMsg('Please select a video file.', false); return }
    setMediaVideoUploading(true)
    try {
      const url = await uploadToCloudinary(file, 'video')
      setNewVideo(p => ({ ...p, url }))
      showMsg('Video uploaded!')
    } catch (err) {
      showMsg(err.message || 'Upload failed.', false)
    } finally {
      setMediaVideoUploading(false)
    }
  }

  const handleAddVideo = async () => {
    if (!newVideo.name || !newVideo.url) { showMsg('Name and video required.', false); return }
    try {
      await uploadMediaVideo(newVideo)
      showMsg('Video added to library!')
      setNewVideo({ name: '', url: '' })
      if (mediaVideoInputRef.current) mediaVideoInputRef.current.value = ''
      loadTabData('Media')
    } catch (err) {
      showMsg(err.message || 'Failed.', false)
    }
  }

  const handleDeleteVideo = async (id) => {
    if (!window.confirm('Delete this video?')) return
    try {
      await deleteMediaVideo(id)
      showMsg('Video deleted.')
      loadTabData('Media')
    } catch (err) {
      showMsg(err.message || 'Delete failed.', false)
    }
  }

  const handleMediaMusicFile = async (file) => {
    if (!file || !file.type.startsWith('audio/')) { showMsg('Please select an audio file.', false); return }
    setMediaMusicUploading(true)
    try {
      const url = await uploadToCloudinary(file, 'auto')
      setNewTrack(p => ({ ...p, url }))
      showMsg('Audio uploaded!')
    } catch (err) {
      showMsg(err.message || 'Upload failed.', false)
    } finally {
      setMediaMusicUploading(false)
    }
  }

  const handleAddTrack = async () => {
    if (!newTrack.name || !newTrack.url) { showMsg('Name and audio required.', false); return }
    try {
      await uploadMediaMusic(newTrack)
      showMsg('Track added to library!')
      setNewTrack({ name: '', url: '' })
      if (mediaMusicInputRef.current) mediaMusicInputRef.current.value = ''
      loadTabData('Media')
    } catch (err) {
      showMsg(err.message || 'Failed.', false)
    }
  }

  const handleDeleteTrack = async (id) => {
    if (!window.confirm('Delete this track?')) return
    try {
      await deleteMediaMusic(id)
      showMsg('Track deleted.')
      loadTabData('Media')
    } catch (err) {
      showMsg(err.message || 'Delete failed.', false)
    }
  }

  return (
    <div className="page-body">
      <ScreenHeader user={currentUser} balance={balance} onAuthOpen={openAuthModal} />
      <div className="screen-body">
        <div className="admin-header">
          <p className="eyebrow">Admin Panel</p>
          <h2>Platform Dashboard</h2>
        </div>

        {actionMsg.text && (
          <p className={`store-earn-msg ${actionMsg.ok ? 'success' : 'error'}`}>{actionMsg.text}</p>
        )}

        {/* Tab Navigation */}
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
            <p>Loading...</p>
          </div>
        )}

        {/* OVERVIEW */}
        {activeTab === 'Overview' && !loading && (
          <div className="admin-section">
            <div className="admin-stats-grid">
              <div className="admin-stat-card">
                <span className="admin-stat-icon">{"\u{1F465}"}</span>
                <div className="admin-stat-value">{stats?.totalUsers ?? '-'}</div>
                <div className="admin-stat-label">Total Users</div>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-icon">{"\u{1F3B4}"}</span>
                <div className="admin-stat-value">{stats?.totalCards ?? '-'}</div>
                <div className="admin-stat-label">Total Cards</div>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-icon">{"\u{1F4CB}"}</span>
                <div className="admin-stat-value">{stats?.totalTemplates ?? '-'}</div>
                <div className="admin-stat-label">Templates</div>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-icon">{"\u{1F4B0}"}</span>
                <div className="admin-stat-value">{stats?.totalRevenue ?? '-'}</div>
                <div className="admin-stat-label">Revenue</div>
              </div>
            </div>

            {/* Referral Stats */}
            {referralStats && (
              <div className="admin-sub-section">
                <h4>Referral Program</h4>
                <div className="admin-stats-grid">
                  <div className="admin-stat-card">
                    <span className="admin-stat-icon">{"\u{1F91D}"}</span>
                    <div className="admin-stat-value">{referralStats.totalReferrals ?? referralStats.total ?? 0}</div>
                    <div className="admin-stat-label">Total Referrals</div>
                  </div>
                  <div className="admin-stat-card">
                    <span className="admin-stat-icon">{"\u{1F4B8}"}</span>
                    <div className="admin-stat-value">{referralStats.totalRewarded ?? referralStats.ccRewarded ?? 0}</div>
                    <div className="admin-stat-label">CC Rewarded</div>
                  </div>
                  <div className="admin-stat-card">
                    <span className="admin-stat-icon">{"\u{1F31F}"}</span>
                    <div className="admin-stat-value">{referralStats.topReferrers?.length ?? 0}</div>
                    <div className="admin-stat-label">Top Referrers</div>
                  </div>
                </div>
              </div>
            )}

            {/* Broadcast Message */}
            <div className="admin-sub-section">
              <h4>Send Message to All Users</h4>
              <p className="admin-section-note">This will notify every registered user with your message.</p>
              <div className="admin-broadcast-form">
                <textarea
                  className="admin-broadcast-textarea"
                  placeholder="Write your message to all users…"
                  value={broadcastMessage}
                  onChange={e => setBroadcastMessage(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
                <div className="admin-broadcast-footer">
                  <span className="admin-broadcast-count">{broadcastMessage.length}/500</span>
                  <button className="primary" type="button" onClick={handleBroadcast} disabled={!broadcastMessage.trim()}>
                    Send to All
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* USERS */}
        {activeTab === 'Users' && !loading && (
          <div className="admin-section">
            <h3 className="admin-section-title">User Management</h3>
            
            {/* Ban Form */}
            <div className="admin-sub-section">
              <h4>Ban User</h4>
              <div className="admin-inline-form">
                <label className="admin-field">
                  <span>User ID</span>
                  <input placeholder="e.g. 65f3a2..." value={banForm.userId} onChange={e => setBanForm(p => ({ ...p, userId: e.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>Ban Duration (days)</span>
                  <input type="number" placeholder="7" value={banForm.durationDays} onChange={e => setBanForm(p => ({ ...p, durationDays: Number(e.target.value) }))} />
                </label>
                <label className="admin-field">
                  <span>Reason</span>
                  <input placeholder="Why are they being banned?" value={banForm.reason} onChange={e => setBanForm(p => ({ ...p, reason: e.target.value }))} />
                </label>
                <button className="primary" type="button" onClick={handleBanUser}>Ban</button>
              </div>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>CC</th>
                    <th>Verified</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user._id || user.id}>
                      <td>{user.username || user.name}</td>
                      <td>{user.email}</td>
                      <td><span className={`admin-role-chip ${(user.role || 'user').toLowerCase()}`}>{user.role || 'User'}</span></td>
                      <td>{user.cc ?? user.balance ?? 0}</td>
                      <td>{user.isVerified ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                  {users.length === 0 && <tr><td colSpan={5}>No users found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TEMPLATES — review & delete */}
        {activeTab === 'Templates' && !loading && (
          <div className="admin-section">
            <h3 className="admin-section-title">Marketplace Templates</h3>
            {(marketplaceTemplates?.length || 0) > 0 ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Preview</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Tier</th>
                      <th>Likes</th>
                      <th>Views</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketplaceTemplates.map((tpl) => (
                      <tr key={tpl.id}>
                        <td>
                          {tpl.previewImage ? (
                            <img
                              src={tpl.previewImage}
                              alt={tpl.title || ''}
                              style={{ width: 64, height: 40, objectFit: 'cover', borderRadius: 6 }}
                            />
                          ) : '—'}
                        </td>
                        <td>{tpl.title || '-'}</td>
                        <td>{tpl.occasion || '-'}</td>
                        <td>{tpl.tier || '-'}</td>
                        <td>{tpl.likeCount ?? tpl.likes ?? 0}</td>
                        <td>{tpl.userCount ?? 0}</td>
                        <td>
                          <span className={`admin-template-status ${(tpl.tag || 'live').toLowerCase()}`}>
                            {tpl.tag || 'Live'}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="admin-action-btn reject"
                            onClick={async () => {
                              if (!window.confirm(`Delete template "${tpl.title}"? This cannot be undone.`)) return
                              const res = await deleteMarketplaceTemplate?.(tpl.templateId || tpl.id)
                              if (res?.ok) showMsg('Template deleted.')
                              else showMsg(res?.message || 'Delete failed.', false)
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="admin-empty">
                <span className="admin-empty-icon">{"\u{1F4C4}"}</span>
                <p>No templates in the marketplace yet.</p>
              </div>
            )}
          </div>
        )}

        {/* ARTISTS — applications */}
        {activeTab === 'Artists' && !loading && (
          <div className="admin-section">
            <h3 className="admin-section-title">Artist Applications</h3>
            {applications.length > 0 ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Portfolio</th>
                      <th>Bio</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map(app => (
                      <tr key={app._id || app.id}>
                        <td>{app.username || app.user?.username || '-'}</td>
                        <td><a href={app.portfolio} target="_blank" rel="noopener noreferrer">{app.portfolio ? 'View' : '-'}</a></td>
                        <td>{app.bio || '-'}</td>
                        <td><span className={`admin-template-status ${app.status || 'pending'}`}>{app.status || 'pending'}</span></td>
                        <td>
                          <button type="button" className="admin-action-btn approve" onClick={() => handleAcceptApplication(app._id || app.id)}>Accept</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="admin-empty">
                <span className="admin-empty-icon">{"\u{1F4CB}"}</span>
                <p>No artist applications pending.</p>
              </div>
            )}
          </div>
        )}

        {/* PACKAGES */}
        {activeTab === 'Packages' && !loading && (
          <div className="admin-section">
            <h3 className="admin-section-title">CC Packages</h3>
            <div className="admin-sub-section">
              <h4>Create Package</h4>
              <div className="admin-form-grid">
                <label className="admin-field">
                  <span>Package Name</span>
                  <input placeholder="e.g. Starter Pack" value={newPkg.name} onChange={e => setNewPkg(p => ({ ...p, name: e.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>Description</span>
                  <input placeholder="Short description shown to users" value={newPkg.description} onChange={e => setNewPkg(p => ({ ...p, description: e.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>CC Granted</span>
                  <input type="number" placeholder="20" value={newPkg.numberOfCC} onChange={e => setNewPkg(p => ({ ...p, numberOfCC: Number(e.target.value) }))} />
                </label>
                <label className="admin-field">
                  <span>Price (USD)</span>
                  <input type="number" placeholder="9.99" value={newPkg.price} onChange={e => setNewPkg(p => ({ ...p, price: Number(e.target.value) }))} step="0.01" />
                </label>
                <label className="admin-check"><input type="checkbox" checked={newPkg.featured} onChange={e => setNewPkg(p => ({ ...p, featured: e.target.checked }))} /> Featured</label>
                <button className="primary" type="button" onClick={handleCreatePackage}>Create</button>
              </div>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Name</th><th>CC</th><th>Price</th><th>Featured</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {packages.map(pkg => (
                    <tr key={pkg._id || pkg.packageId}>
                      <td>{pkg.name}</td>
                      <td>{pkg.numberOfCC}</td>
                      <td>{pkg.price}</td>
                      <td>{pkg.featured ? 'Starred' : '-'}</td>
                      <td>
                        <button type="button" className="admin-action-btn approve" onClick={() => handleTogglePackage(pkg)}>
                          {pkg.isActive ? 'Disable' : 'Enable'}
                        </button>
                        <button type="button" className="admin-action-btn reject" onClick={() => handleDeletePackage(pkg.packageId || pkg._id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                  {packages.length === 0 && <tr><td colSpan={5}>No packages.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REDEEM CODES */}
        {activeTab === 'Codes' && !loading && (
          <div className="admin-section">
            <h3 className="admin-section-title">Redeem Codes</h3>
            <div className="admin-sub-section">
              <h4>Generate Code</h4>
              <div className="admin-inline-form">
                <label className="admin-field">
                  <span>CC per Redemption</span>
                  <input type="number" placeholder="10" value={newCode.numberOfCC} onChange={e => setNewCode(p => ({ ...p, numberOfCC: Number(e.target.value) }))} />
                </label>
                <label className="admin-field">
                  <span>Max Total Uses</span>
                  <input type="number" placeholder="200" value={newCode.maxUses} onChange={e => setNewCode(p => ({ ...p, maxUses: Number(e.target.value) }))} />
                </label>
                <button className="primary" type="button" onClick={handleCreateCode}>Generate</button>
              </div>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Code</th><th>CC</th><th>Uses</th><th>Active</th></tr>
                </thead>
                <tbody>
                  {redeemCodes.map(code => (
                    <tr key={code._id || code.code}>
                      <td><code>{code.code}</code></td>
                      <td>{code.numberOfCC}</td>
                      <td>{code.usedCount ?? 0}/{code.maxUses ?? 'Unlimited'}</td>
                      <td>{code.isActive ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                  {redeemCodes.length === 0 && <tr><td colSpan={4}>No codes.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ADS */}
        {activeTab === 'Ads' && !loading && (
          <div className="admin-section">
            <h3 className="admin-section-title">Rewarded Ads</h3>
            <div className="admin-sub-section">
              <h4>Create Ad</h4>
              <div className="admin-form-grid">
                <label className="admin-field">
                  <span>Ad Name</span>
                  <input placeholder="e.g. Summer Promo" value={newAd.name} onChange={e => setNewAd(p => ({ ...p, name: e.target.value }))} />
                </label>
                <Dropdown
                  value={newAd.type}
                  onChange={(v) => setNewAd(p => ({ ...p, type: v }))}
                  options={[
                    { value: 'external', label: 'External' },
                    { value: 'internal', label: 'Internal' },
                  ]}
                />

                {/* Video drag-and-drop upload */}
                <div
                  className={`admin-video-drop${adVideoDragOver ? ' dragging' : ''}${newAd.videoUrl ? ' has-video' : ''}`}
                  onDragOver={e => { e.preventDefault(); setAdVideoDragOver(true) }}
                  onDragLeave={() => setAdVideoDragOver(false)}
                  onDrop={e => {
                    e.preventDefault()
                    setAdVideoDragOver(false)
                    handleAdVideoFile(e.dataTransfer.files?.[0])
                  }}
                  onClick={() => !adVideoUploading && adVideoInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && adVideoInputRef.current?.click()}
                >
                  <input
                    ref={adVideoInputRef}
                    type="file"
                    accept="video/*"
                    style={{ display: 'none' }}
                    onChange={e => handleAdVideoFile(e.target.files?.[0])}
                  />
                  {adVideoUploading ? (
                    <div className="admin-video-drop-info">
                      <div className="chat-loading-spinner" style={{ width: 22, height: 22 }} />
                      <span>Uploading to cloud...</span>
                    </div>
                  ) : newAd.videoUrl ? (
                    <div className="admin-video-drop-info">
                      <span className="admin-video-drop-check">&#10003;</span>
                      <span className="admin-video-drop-label">Video uploaded</span>
                      <span className="admin-video-preview-url">{newAd.videoUrl}</span>
                      <span className="admin-video-drop-hint">Click or drop to replace</span>
                    </div>
                  ) : (
                    <div className="admin-video-drop-info">
                      <span className="admin-video-drop-icon">&#127909;</span>
                      <span className="admin-video-drop-label">Drag & drop video here</span>
                      <span className="admin-video-drop-hint">or click to browse</span>
                    </div>
                  )}
                </div>

                <label className="admin-field">
                  <span>CC Reward per View</span>
                  <input type="number" placeholder="2" value={newAd.rewardCC} onChange={e => setNewAd(p => ({ ...p, rewardCC: Number(e.target.value) }))} />
                </label>
                <label className="admin-field">
                  <span>Watch Duration (seconds)</span>
                  <input type="number" placeholder="30" value={newAd.duration} onChange={e => setNewAd(p => ({ ...p, duration: Number(e.target.value) }))} />
                </label>
                <label className="admin-field">
                  <span>Display Priority (higher = shown first)</span>
                  <input type="number" placeholder="1" value={newAd.priority} onChange={e => setNewAd(p => ({ ...p, priority: Number(e.target.value) }))} />
                </label>
                <button className="primary" type="button" onClick={handleCreateAd} disabled={adVideoUploading}>
                  {adVideoUploading ? 'Uploading...' : 'Create'}
                </button>
              </div>
            </div>
            {adsAnalytics && (
              <div className="admin-stats-grid" style={{ marginBottom: 16 }}>
                <div className="admin-stat-card">
                  <span className="admin-stat-icon">{"\u{1F3AC}"}</span>
                  <div className="admin-stat-value">{adsAnalytics.totalViews ?? adsAnalytics.views ?? 0}</div>
                  <div className="admin-stat-label">Total Views</div>
                </div>
                <div className="admin-stat-card">
                  <span className="admin-stat-icon">{"\u{1F4B0}"}</span>
                  <div className="admin-stat-value">{adsAnalytics.totalCCPaid ?? adsAnalytics.ccPaid ?? 0}</div>
                  <div className="admin-stat-label">CC Paid Out</div>
                </div>
                <div className="admin-stat-card">
                  <span className="admin-stat-icon">{"\u{1F465}"}</span>
                  <div className="admin-stat-value">{adsAnalytics.uniqueUsers ?? 0}</div>
                  <div className="admin-stat-label">Unique Users</div>
                </div>
              </div>
            )}
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Name</th><th>Type</th><th>Reward</th><th>Duration</th><th>Active</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {ads.map(ad => (
                    <tr key={ad._id || ad.id}>
                      <td>{ad.name || '—'}</td>
                      <td>{ad.type}</td>
                      <td>{ad.rewardCC} CC</td>
                      <td>{ad.duration}s</td>
                      <td>{ad.isActive ? 'Yes' : 'No'}</td>
                      <td>
                        <button type="button" className="admin-action-btn approve" onClick={() => handleToggleAd(ad)}>
                          {ad.isActive ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {ads.length === 0 && <tr><td colSpan={5}>No ads.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MEDIA LIBRARY */}
        {activeTab === 'Media' && !loading && (
          <div className="admin-section">
            <h3 className="admin-section-title">Media Library</h3>
            <p className="admin-section-note">Upload videos and music that users can pick inside Card Studio backgrounds.</p>

            {/* ── Background Videos ── */}
            <div className="admin-media-block">
              <div className="admin-media-block-header">
                <span className="admin-media-block-icon">🎬</span>
                <div>
                  <h4 className="admin-media-block-title">Background Videos</h4>
                  <p className="admin-media-block-desc">Looping videos available as card backgrounds in the studio.</p>
                </div>
              </div>

              {/* Upload form */}
              <div className="admin-media-add-form">
                <input
                  ref={mediaVideoInputRef}
                  type="file"
                  accept="video/*"
                  style={{ display: 'none' }}
                  onChange={e => handleMediaVideoFile(e.target.files?.[0])}
                />
                <div className="admin-media-add-row">
                  <label className="admin-field admin-media-title-field">
                    <span>Video Name</span>
                    <input
                      placeholder="e.g. Ocean Waves"
                      value={newVideo.name}
                      onChange={e => setNewVideo(p => ({ ...p, name: e.target.value }))}
                    />
                  </label>
                  <button
                    type="button"
                    className={`admin-media-file-btn${newVideo.url ? ' ready' : ''}${mediaVideoUploading ? ' uploading' : ''}`}
                    onClick={() => !mediaVideoUploading && mediaVideoInputRef.current?.click()}
                    disabled={mediaVideoUploading}
                  >
                    {mediaVideoUploading ? (
                      <><span className="admin-media-file-spinner" />Uploading…</>
                    ) : newVideo.url ? (
                      <><span>✓</span> Video ready</>
                    ) : (
                      <><span className="admin-media-file-icon">↑</span> Choose file</>
                    )}
                  </button>
                  <button
                    className="primary admin-media-add-btn"
                    type="button"
                    onClick={handleAddVideo}
                    disabled={mediaVideoUploading || !newVideo.url || !newVideo.name.trim()}
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Video grid */}
              {mediaVideos.length > 0 ? (
                <div className="admin-media-video-grid">
                  {mediaVideos.map(v => (
                    <div key={v._id || v.id} className="admin-media-video-card">
                      <div className="admin-media-video-thumb-wrap">
                        <video
                          src={v.url || v.videoUrl}
                          muted
                          loop
                          playsInline
                          className="admin-media-video-thumb"
                          onMouseEnter={e => e.currentTarget.play()}
                          onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0 }}
                        />
                        <div className="admin-media-video-play-hint">▶</div>
                      </div>
                      <div className="admin-media-video-footer">
                        <span className="admin-media-video-title">{v.title || 'Untitled'}</span>
                        <button
                          type="button"
                          className="admin-media-delete-btn"
                          onClick={() => handleDeleteVideo(v._id || v.id)}
                          aria-label="Delete"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="admin-media-empty">
                  <span>🎬</span>
                  <p>No videos yet. Add the first one above.</p>
                </div>
              )}
            </div>

            {/* ── Music Tracks ── */}
            <div className="admin-media-block">
              <div className="admin-media-block-header">
                <span className="admin-media-block-icon">🎵</span>
                <div>
                  <h4 className="admin-media-block-title">Music Tracks</h4>
                  <p className="admin-media-block-desc">Audio tracks users can set as card background music.</p>
                </div>
              </div>

              {/* Upload form */}
              <div className="admin-media-add-form">
                <input
                  ref={mediaMusicInputRef}
                  type="file"
                  accept="audio/*"
                  style={{ display: 'none' }}
                  onChange={e => handleMediaMusicFile(e.target.files?.[0])}
                />
                <div className="admin-media-add-row">
                  <label className="admin-field admin-media-title-field">
                    <span>Track Name</span>
                    <input
                      placeholder="e.g. Soft Piano"
                      value={newTrack.name}
                      onChange={e => setNewTrack(p => ({ ...p, name: e.target.value }))}
                    />
                  </label>
                  <button
                    type="button"
                    className={`admin-media-file-btn${newTrack.url ? ' ready' : ''}${mediaMusicUploading ? ' uploading' : ''}`}
                    onClick={() => !mediaMusicUploading && mediaMusicInputRef.current?.click()}
                    disabled={mediaMusicUploading}
                  >
                    {mediaMusicUploading ? (
                      <><span className="admin-media-file-spinner" />Uploading…</>
                    ) : newTrack.url ? (
                      <><span>✓</span> Audio ready</>
                    ) : (
                      <><span className="admin-media-file-icon">↑</span> Choose file</>
                    )}
                  </button>
                  <button
                    className="primary admin-media-add-btn"
                    type="button"
                    onClick={handleAddTrack}
                    disabled={mediaMusicUploading || !newTrack.url || !newTrack.name.trim()}
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Music list */}
              {mediaMusic.length > 0 ? (
                <div className="admin-media-music-list">
                  {mediaMusic.map(track => (
                    <div key={track._id || track.id} className="admin-media-music-item">
                      <div className="admin-media-music-icon">♫</div>
                      <div className="admin-media-music-info">
                        <span className="admin-media-music-name">{track.title || 'Untitled'}</span>
                        <audio controls src={track.url || track.audioUrl} className="admin-media-music-player" />
                      </div>
                      <button
                        type="button"
                        className="admin-media-delete-btn"
                        onClick={() => handleDeleteTrack(track._id || track.id)}
                        aria-label="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="admin-media-empty">
                  <span>🎵</span>
                  <p>No tracks yet. Add the first one above.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* COUPONS */}
        {activeTab === 'Coupons' && !loading && (
          <div className="admin-section">
            <h3 className="admin-section-title">Coupon Management</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Code</th><th>Type</th><th>Value</th><th>Used</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {coupons.map((c, i) => (
                    <tr key={c._id || c.code || i}>
                      <td><code>{c.code || '-'}</code></td>
                      <td>{c.type || c.kind || '-'}</td>
                      <td>{c.value ?? c.amount ?? c.numberOfCC ?? '-'}</td>
                      <td>{c.usedCount ?? c.uses ?? 0}</td>
                      <td>{c.isActive !== false ? 'Active' : 'Inactive'}</td>
                    </tr>
                  ))}
                  {coupons.length === 0 && <tr><td colSpan={5}>No coupons.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* LOGS */}
        {activeTab === 'Logs' && !loading && (
          <div className="admin-section">
            <h3 className="admin-section-title">Action Logs</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Admin</th><th>Action</th><th>Target</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={log._id || i}>
                      <td>{log.adminId || log.admin || '-'}</td>
                      <td>{log.action || log.type || '-'}</td>
                      <td>{log.targetId || log.target || '-'}</td>
                      <td>{log.createdAt ? new Date(log.createdAt).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && <tr><td colSpan={4}>No logs yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <ScreenNav />
    </div>
  )
}

export default AdminDashboard


