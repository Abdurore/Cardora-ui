import { useOutletContext, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import { getEnterpriseAdStats, updateAdminAd } from '../lib/api.js'

function EnterpriseDashboard() {
  const { currentUser, balance, openAuthModal } = useOutletContext()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [ads, setAds] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [updatingAdId, setUpdatingAdId] = useState('')

  const isEnterprise = currentUser?.role === 'Enterprise'

  useEffect(() => {
    if (!isEnterprise) return
    setLoading(true)
    getEnterpriseAdStats()
      .then(res => {
        const payload = res?.data || res
        setStats(payload)
        setAds(payload?.ads || [])
      })
      .catch(err => setError(err?.message || 'Failed to load stats.'))
      .finally(() => setLoading(false))
  }, [isEnterprise])

  const handleToggleAd = async (ad) => {
    const adId = ad._id || ad.id || ad.adId
    if (!adId) return
    const nextActive = !(ad.active || ad.isActive)
    setUpdatingAdId(adId)
    setError('')
    try {
      await updateAdminAd(adId, { isActive: nextActive, active: nextActive })
      setAds(prev => prev.map(item => {
        const itemId = item._id || item.id || item.adId
        return itemId === adId ? { ...item, isActive: nextActive, active: nextActive } : item
      }))
    } catch (err) {
      setError(err?.message || 'Could not update this ad.')
    } finally {
      setUpdatingAdId('')
    }
  }

  if (!isEnterprise) {
    return (
      <div className="page-body">
        <ScreenHeader user={currentUser} balance={balance} onAuthOpen={openAuthModal} />
        <div className="screen-body">
          <div className="admin-restricted">
            <h2>Access Restricted</h2>
            <p>This dashboard is only available to Enterprise accounts.</p>
            <button className="primary" type="button" onClick={() => navigate('/')}>Go Home</button>
          </div>
        </div>
        <ScreenNav />
      </div>
    )
  }

  const adStats = stats?.stats || stats?.adStats || stats

  return (
    <div className="page-body">
      <ScreenHeader user={currentUser} balance={balance} onAuthOpen={openAuthModal} />
      <div className="screen-body">
        <div className="admin-header">
          <p className="eyebrow">Enterprise Panel</p>
          <h2>Enterprise Dashboard</h2>
        </div>

        {loading && (
          <div className="profile-cards-loading">
            <div className="chat-loading-spinner" />
            <p>Loading…</p>
          </div>
        )}

        {error && <p className="store-earn-msg error">{error}</p>}

        {!loading && (
          <>
            {/* Ad Performance Stats */}
            <div className="admin-section">
              <h3 className="admin-section-title">Ad Performance</h3>
              <div className="admin-stats-grid">
                <div className="admin-stat-card">
                  <span className="admin-stat-icon">👁</span>
                  <div className="admin-stat-value">{adStats?.views ?? adStats?.totalViews ?? '—'}</div>
                  <div className="admin-stat-label">Views</div>
                </div>
                <div className="admin-stat-card">
                  <span className="admin-stat-icon">📣</span>
                  <div className="admin-stat-value">{adStats?.impressions ?? adStats?.totalImpressions ?? '—'}</div>
                  <div className="admin-stat-label">Impressions</div>
                </div>
                <div className="admin-stat-card">
                  <span className="admin-stat-icon">🖱</span>
                  <div className="admin-stat-value">{adStats?.clicks ?? adStats?.totalClicks ?? '—'}</div>
                  <div className="admin-stat-label">Clicks</div>
                </div>
                <div className="admin-stat-card">
                  <span className="admin-stat-icon">✅</span>
                  <div className="admin-stat-value">{adStats?.completions ?? adStats?.totalCompletions ?? '—'}</div>
                  <div className="admin-stat-label">Completions</div>
                </div>
                <div className="admin-stat-card">
                  <span className="admin-stat-icon">👤</span>
                  <div className="admin-stat-value">{adStats?.uniqueViewers ?? adStats?.uniqueUsers ?? '—'}</div>
                  <div className="admin-stat-label">Unique Viewers</div>
                </div>
              </div>
            </div>

            {/* Ad List */}
            {ads.length > 0 && (
              <div className="admin-section">
                <h3 className="admin-section-title">Your Ads</h3>
                <p className="admin-section-note">Toggle active status for ads assigned to your Enterprise account.</p>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Reward</th>
                        <th>Duration</th>
                        <th>Views / Max</th>
                        <th>Status</th>
                        <th>Control</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ads.map((ad, i) => (
                        <tr key={ad._id || ad.adId || i}>
                          <td>{ad.name || ad.title || '—'}</td>
                          <td>{ad.type || '—'}</td>
                          <td>{ad.reward ?? ad.rewardCC ?? '—'} CC</td>
                          <td>{ad.duration ? `${ad.duration}s` : '—'}</td>
                          <td>{ad.views ?? 0} / {ad.maxViews ?? '∞'}</td>
                          <td>
                            <span className={`admin-status-chip ${ad.active || ad.isActive ? 'open' : 'resolved'}`}>
                              {ad.active || ad.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="admin-action-btn approve"
                              onClick={() => handleToggleAd(ad)}
                              disabled={updatingAdId === (ad._id || ad.id || ad.adId)}
                            >
                              {updatingAdId === (ad._id || ad.id || ad.adId)
                                ? 'Saving...'
                                : (ad.active || ad.isActive ? 'Pause' : 'Resume')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Enterprise Benefits */}
            <div className="admin-section">
              <h3 className="admin-section-title">Enterprise Benefits</h3>
              <div className="enterprise-benefits-grid">
                <div className="enterprise-benefit-card">
                  <span className="enterprise-benefit-icon">📊</span>
                  <h4>Ad Analytics</h4>
                  <p>Track views, impressions, clicks, and completions for your sponsored ads in real time.</p>
                </div>
                <div className="enterprise-benefit-card">
                  <span className="enterprise-benefit-icon">🎯</span>
                  <h4>Targeted Reach</h4>
                  <p>Your ads are shown to Cardora users during card interactions, maximising engagement.</p>
                </div>
                <div className="enterprise-benefit-card">
                  <span className="enterprise-benefit-icon">🏢</span>
                  <h4>Dedicated Support</h4>
                  <p>Get priority support and custom ad configurations managed by the Cardora team.</p>
                </div>
                <div className="enterprise-benefit-card">
                  <span className="enterprise-benefit-icon">💬</span>
                  <h4>Custom Campaigns</h4>
                  <p>Work with us to design bespoke reward structures and creative ad formats for your brand.</p>
                </div>
              </div>
              <p className="admin-section-note" style={{ marginTop: 16 }}>
                To create new ads or modify existing ones, contact{' '}
                <a href="mailto:enterprise@cardora.app" className="enterprise-contact-link">enterprise@cardora.app</a>.
              </p>
            </div>
          </>
        )}
      </div>
      <ScreenNav />
    </div>
  )
}

export default EnterpriseDashboard
