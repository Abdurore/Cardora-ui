import { useOutletContext, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
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
  getAdminAdsAnalytics,
  getAdminActionLogs,
  sendSeasonalReminder,
} from '../lib/api.js'

const TABS = ['Overview', 'Users', 'Templates', 'Packages', 'Codes', 'Ads', 'Logs']

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
  const { currentUser, balance, openAuthModal } = useOutletContext()
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
  const [loading, setLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState({ text: '', ok: false })

  // New package form
  const [newPkg, setNewPkg] = useState({ name: '', description: '', numberOfCC: 20, price: 9.99, isActive: true, featured: false })
  // New redeem code form
  const [newCode, setNewCode] = useState({ numberOfCC: 10, maxUses: 200, isActive: true })
  // New ad form
  const [newAd, setNewAd] = useState({ type: 'external', videoUrl: '', rewardCC: 2, duration: 30, isActive: true, priority: 1 })
  // Ban form
  const [banForm, setBanForm] = useState({ userId: '', durationDays: 7, reason: '' })
  // Seasonal reminder
  const [season, setSeason] = useState('valentines')

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
          const [overviewRes, dashboardRes, usersStatsRes, cardsStatsRes, templatesStatsRes] = await Promise.allSettled([
            getAdminStatsOverview(),
            getAdminDashboard(),
            getAdminStatsUsers(),
            getAdminStatsCards(),
            getAdminStatsTemplates(),
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
          break
        }
        case 'Users': {
          const res = await getAdminUsers()
          setUsers(res?.data?.users || res?.users || [])
          break
        }
        case 'Templates': {
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

  const handleCreateAd = async () => {
    if (!newAd.videoUrl) { showMsg('Video URL required', false); return }
    try {
      await createAdminAd(newAd)
      showMsg('Ad created!')
      setNewAd({ type: 'external', videoUrl: '', rewardCC: 2, duration: 30, isActive: true, priority: 1 })
      loadTabData('Ads')
    } catch (err) {
      showMsg(err.message || 'Failed', false)
    }
  }

  const handleSeasonalReminder = async () => {
    try {
      await sendSeasonalReminder({ season })
      showMsg(`${season} reminder sent!`)
    } catch (err) {
      showMsg(err.message || 'Failed', false)
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

            {/* Seasonal Reminder */}
            <div className="admin-sub-section">
              <h4>Send Seasonal Reminder</h4>
              <div className="admin-inline-form">
                <select value={season} onChange={e => setSeason(e.target.value)}>
                  <option value="valentines">Valentine's Day</option>
                  <option value="christmas">Christmas</option>
                  <option value="mothers_day">Mother's Day</option>
                  <option value="fathers_day">Father's Day</option>
                  <option value="independence_day">Independence Day</option>
                </select>
                <button className="primary" type="button" onClick={handleSeasonalReminder}>Send</button>
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
                <input placeholder="User ID" value={banForm.userId} onChange={e => setBanForm(p => ({ ...p, userId: e.target.value }))} />
                <input type="number" placeholder="Days" value={banForm.durationDays} onChange={e => setBanForm(p => ({ ...p, durationDays: Number(e.target.value) }))} style={{ width: 80 }} />
                <input placeholder="Reason" value={banForm.reason} onChange={e => setBanForm(p => ({ ...p, reason: e.target.value }))} />
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

        {/* TEMPLATES / ARTIST APPLICATIONS */}
        {activeTab === 'Templates' && !loading && (
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
                <input placeholder="Name" value={newPkg.name} onChange={e => setNewPkg(p => ({ ...p, name: e.target.value }))} />
                <input placeholder="Description" value={newPkg.description} onChange={e => setNewPkg(p => ({ ...p, description: e.target.value }))} />
                <input type="number" placeholder="CC Amount" value={newPkg.numberOfCC} onChange={e => setNewPkg(p => ({ ...p, numberOfCC: Number(e.target.value) }))} />
                <input type="number" placeholder="Price" value={newPkg.price} onChange={e => setNewPkg(p => ({ ...p, price: Number(e.target.value) }))} step="0.01" />
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
                      <td><button type="button" className="admin-action-btn reject" onClick={() => handleDeletePackage(pkg.packageId || pkg._id)}>Delete</button></td>
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
                <input type="number" placeholder="CC Amount" value={newCode.numberOfCC} onChange={e => setNewCode(p => ({ ...p, numberOfCC: Number(e.target.value) }))} />
                <input type="number" placeholder="Max Uses" value={newCode.maxUses} onChange={e => setNewCode(p => ({ ...p, maxUses: Number(e.target.value) }))} />
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
                <select value={newAd.type} onChange={e => setNewAd(p => ({ ...p, type: e.target.value }))}>
                  <option value="external">External</option>
                  <option value="internal">Internal</option>
                </select>
                <input placeholder="Video URL" value={newAd.videoUrl} onChange={e => setNewAd(p => ({ ...p, videoUrl: e.target.value }))} />
                <input type="number" placeholder="Reward CC" value={newAd.rewardCC} onChange={e => setNewAd(p => ({ ...p, rewardCC: Number(e.target.value) }))} />
                <input type="number" placeholder="Duration (s)" value={newAd.duration} onChange={e => setNewAd(p => ({ ...p, duration: Number(e.target.value) }))} />
                <input type="number" placeholder="Priority" value={newAd.priority} onChange={e => setNewAd(p => ({ ...p, priority: Number(e.target.value) }))} />
                <button className="primary" type="button" onClick={handleCreateAd}>Create</button>
              </div>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Type</th><th>Reward</th><th>Duration</th><th>Active</th></tr>
                </thead>
                <tbody>
                  {ads.map(ad => (
                    <tr key={ad._id || ad.id}>
                      <td>{ad.type}</td>
                      <td>{ad.rewardCC} CC</td>
                      <td>{ad.duration}s</td>
                      <td>{ad.isActive ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                  {ads.length === 0 && <tr><td colSpan={4}>No ads.</td></tr>}
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


