import { useOutletContext, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'

const TABS = ['Overview', 'Users', 'Payments', 'Templates']

function AdminDashboard() {
  const { currentUser, balance, openAuthModal } = useOutletContext()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('Overview')

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

  const publishedTemplates = JSON.parse(localStorage.getItem('cardora:publishedTemplates') || '[]')

  return (
    <div className="page-body">
      <ScreenHeader user={currentUser} balance={balance} onAuthOpen={openAuthModal} />
      <div className="screen-body">
        <div className="admin-header">
          <p className="eyebrow">Admin Panel</p>
          <h2>Platform Dashboard</h2>
        </div>

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

        {/* Overview */}
        {activeTab === 'Overview' && (
          <div className="admin-section">
            <div className="admin-stats-grid">
              <div className="admin-stat-card">
                <span className="admin-stat-icon">👥</span>
                <div className="admin-stat-value">3</div>
                <div className="admin-stat-label">Total Users</div>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-icon">🎴</span>
                <div className="admin-stat-value">{publishedTemplates.length}</div>
                <div className="admin-stat-label">Published Templates</div>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-icon">💰</span>
                <div className="admin-stat-value">$0</div>
                <div className="admin-stat-label">Revenue (pending)</div>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-icon">📦</span>
                <div className="admin-stat-value">0</div>
                <div className="admin-stat-label">Pending Orders</div>
              </div>
            </div>
            <div className="admin-notice">
              <p><strong>Backend Integration Pending</strong></p>
              <p>Real-time metrics, user activity, and revenue tracking will be connected once the backend API is live.</p>
            </div>
          </div>
        )}

        {/* Users */}
        {activeTab === 'Users' && (
          <div className="admin-section">
            <h3 className="admin-section-title">User Management</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Balance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>The Creator</td>
                    <td>@creator</td>
                    <td><span className="admin-role-chip artist">Artist</span></td>
                    <td>50 CC</td>
                    <td><span className="admin-status-dot active" /> Active</td>
                  </tr>
                  <tr>
                    <td>Sunset Muse</td>
                    <td>@sunsetmuse</td>
                    <td><span className="admin-role-chip creator">Creator</span></td>
                    <td>50 CC</td>
                    <td><span className="admin-status-dot active" /> Active</td>
                  </tr>
                  <tr>
                    <td>Admin</td>
                    <td>@admin</td>
                    <td><span className="admin-role-chip admin">Admin</span></td>
                    <td>500 CC</td>
                    <td><span className="admin-status-dot active" /> Active</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payments */}
        {activeTab === 'Payments' && (
          <div className="admin-section">
            <h3 className="admin-section-title">Incoming Payments</h3>
            <div className="admin-empty">
              <span className="admin-empty-icon">💳</span>
              <p>No payments recorded yet.</p>
              <p className="admin-empty-sub">Payment processing will be handled by the backend. This section will show real-time transaction logs, refund requests, and revenue summaries.</p>
            </div>
          </div>
        )}

        {/* Templates */}
        {activeTab === 'Templates' && (
          <div className="admin-section">
            <h3 className="admin-section-title">Template Moderation</h3>
            {publishedTemplates.length > 0 ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Artist</th>
                      <th>Submitted</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {publishedTemplates.map(tmpl => (
                      <tr key={tmpl.id}>
                        <td>{tmpl.title}</td>
                        <td>{tmpl.artist}</td>
                        <td>{new Date(tmpl.publishedAt).toLocaleDateString()}</td>
                        <td><span className={`admin-template-status ${tmpl.status}`}>{tmpl.status}</span></td>
                        <td>
                          <button type="button" className="admin-action-btn approve" onClick={() => {
                            const all = JSON.parse(localStorage.getItem('cardora:publishedTemplates') || '[]')
                            const idx = all.findIndex(t => t.id === tmpl.id)
                            if (idx >= 0) { all[idx].status = 'approved'; localStorage.setItem('cardora:publishedTemplates', JSON.stringify(all)) }
                          }}>Approve</button>
                          <button type="button" className="admin-action-btn reject" onClick={() => {
                            const all = JSON.parse(localStorage.getItem('cardora:publishedTemplates') || '[]')
                            const idx = all.findIndex(t => t.id === tmpl.id)
                            if (idx >= 0) { all[idx].status = 'rejected'; localStorage.setItem('cardora:publishedTemplates', JSON.stringify(all)) }
                          }}>Reject</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="admin-empty">
                <span className="admin-empty-icon">📋</span>
                <p>No templates submitted for review yet.</p>
                <p className="admin-empty-sub">When artists publish templates from the studio, they'll appear here for moderation.</p>
              </div>
            )}
          </div>
        )}
      </div>
      <ScreenNav />
    </div>
  )
}

export default AdminDashboard
