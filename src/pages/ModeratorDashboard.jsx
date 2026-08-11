import { useOutletContext, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import StatusModal from '../components/StatusModal.jsx'
import Dropdown from '../components/Dropdown.jsx'
import { useAppConfirm } from '../hooks/useAppConfirm.jsx'
import { uploadToCloudinary } from '../lib/cloudinary.js'
import {
  getAdminReports,
  updateAdminReportStatus,
  banUser,
  unbanUser,
  disableAdminTemplate,
  getTemplates,
  getModeratorActionLogs,
  submitBroadcastRequest,
  requestChatFrame,
} from '../lib/api.js'

const TABS = ['Reports', 'Users', 'Templates', 'Logs', 'Broadcast', 'Chat Frames']

function ModeratorDashboard() {
  const { currentUser, balance, openAuthModal } = useOutletContext()
  const navigate = useNavigate()
  const { confirm: appConfirm, ConfirmModal } = useAppConfirm()
  const [statusModal, setStatusModal] = useState(null)
  const [activeTab, setActiveTab] = useState('Reports')
  const [loading, setLoading] = useState(false)

  // Reports
  const [reports, setReports] = useState([])
  const [reportFilter, setReportFilter] = useState({ type: '', status: 'open' })

  // Users
  const [banForm, setBanForm] = useState({ identifier: '', durationDays: 7, reason: '' })
  const [unbanId, setUnbanId] = useState('')
  const [banConfirm, setBanConfirm] = useState(null)
  const [banSubmitting, setBanSubmitting] = useState(false)

  // Templates
  const [templates, setTemplates] = useState([])

  // Logs
  const [logs, setLogs] = useState([])

  // Broadcast request
  const [broadcastForm, setBroadcastForm] = useState({ subject: '', message: '' })
  const [broadcastSubmitting, setBroadcastSubmitting] = useState(false)

  // Chat frame request
  const [chatFrameForm, setChatFrameForm] = useState({ name: '', url: '', reason: '' })
  const [chatFrameSubmitting, setChatFrameSubmitting] = useState(false)
  const [chatFrameUploading, setChatFrameUploading] = useState(false)
  const [chatFrameDragOver, setChatFrameDragOver] = useState(false)
  const chatFrameInputRef = useRef(null)

  const isModerator = String(currentUser?.role || '').toLowerCase() === 'moderator'

  const showMsg = (text, ok = true) => {
    setStatusModal({ type: ok ? 'success' : 'error', message: text })
  }

  const loadReports = async (overrides = {}) => {
    const f = { ...reportFilter, ...overrides }
    setLoading(true)
    try {
      const q = `type=${f.type}&status=${f.status}&page=1&limit=100`
      const res = await getAdminReports(q)
      setReports(res?.data?.reports || res?.reports || [])
    } catch (err) {
      console.error('Reports load failed', err)
    }
    setLoading(false)
  }

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const res = await getTemplates('page=1&limit=200')
      setTemplates(res?.data?.templates || res?.templates || [])
    } catch (err) {
      console.error('Templates load failed', err)
    }
    setLoading(false)
  }

  const loadLogs = async () => {
    setLoading(true)
    try {
      const res = await getModeratorActionLogs()
      setLogs(res?.data?.logs || res?.logs || [])
    } catch (err) {
      console.error('Logs load failed', err)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!isModerator) return
    if (activeTab === 'Reports') loadReports()
    else if (activeTab === 'Templates') loadTemplates()
    else if (activeTab === 'Logs') loadLogs()
  }, [activeTab, isModerator]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleBan = async () => {
    if (!banConfirm) return
    setBanSubmitting(true)
    try {
      await banUser(banConfirm.payload)
      showMsg('User banned.')
      setBanForm({ identifier: '', durationDays: 7, reason: '' })
      setBanConfirm(null)
    } catch (err) {
      showMsg(err.message || 'Ban failed.', false)
    } finally {
      setBanSubmitting(false)
    }
  }

  const handleUnban = async () => {
    const id = unbanId.trim()
    if (!id) { showMsg('User ID or username required.', false); return }
    if (!await appConfirm('Unban User', `Unban "${id}"?`)) return
    try {
      await unbanUser({ identifier: id, userId: id })
      showMsg(`"${id}" unbanned.`)
      setUnbanId('')
    } catch (err) {
      showMsg(err.message || 'Unban failed.', false)
    }
  }

  const handleUpdateReportStatus = async (report, status) => {
    const reportId = report.reportId || report._id
    if (!reportId) return
    try {
      await updateAdminReportStatus(reportId, status)
      setReports(prev => prev.map(r => ((r.reportId || r._id) === reportId ? { ...r, status } : r)))
      showMsg(`Report marked ${status}.`)
    } catch (err) {
      showMsg(err.message || 'Failed to update report.', false)
    }
  }

  const handleDisableTemplate = async (tpl) => {
    const id = tpl.templateId || tpl._id || tpl.id
    if (!id) return
    if (!await appConfirm('Disable Template', `Disable "${tpl.name || tpl.title}"?`, { variant: 'warning', confirmLabel: 'Disable' })) return
    try {
      await disableAdminTemplate(id)
      showMsg('Template disabled.')
      setTemplates(prev => prev.filter(t => (t.templateId || t._id || t.id) !== id))
    } catch (err) {
      showMsg(err.message || 'Disable failed.', false)
    }
  }

  const handleBroadcastRequest = async () => {
    if (!broadcastForm.subject.trim() || !broadcastForm.message.trim()) {
      showMsg('Subject and message are both required.', false); return
    }
    setBroadcastSubmitting(true)
    try {
      await submitBroadcastRequest({ subject: broadcastForm.subject.trim(), message: broadcastForm.message.trim() })
      showMsg('Broadcast request submitted to admin for approval.')
      setBroadcastForm({ subject: '', message: '' })
    } catch (err) {
      showMsg(err.message || 'Submission failed.', false)
    } finally {
      setBroadcastSubmitting(false)
    }
  }

  const handleChatFrameFile = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showMsg(`Please select an image file. Got "${file.type || 'unknown'}".`, false)
      return
    }
    setChatFrameUploading(true)
    try {
      const url = await uploadToCloudinary(file, 'image')
      const fallbackName = file.name.replace(/\.[^.]+$/, '').slice(0, 80)
      setChatFrameForm(p => ({ ...p, name: p.name || fallbackName, url }))
      showMsg('Frame image uploaded.')
    } catch (err) {
      showMsg(err.message || 'Frame upload failed.', false)
    } finally {
      setChatFrameUploading(false)
    }
  }

  const handleChatFrameRequest = async () => {
    if (!chatFrameForm.name.trim() || !chatFrameForm.url.trim()) {
      showMsg('Frame name and URL are required.', false); return
    }
    setChatFrameSubmitting(true)
    try {
      await requestChatFrame({
        name: chatFrameForm.name.trim(),
        url: chatFrameForm.url.trim(),
        reason: chatFrameForm.reason.trim() || undefined,
      })
      showMsg('Chat frame request submitted to admin for approval.')
      setChatFrameForm({ name: '', url: '', reason: '' })
    } catch (err) {
      showMsg(err.message || 'Chat frame request failed.', false)
    } finally {
      setChatFrameSubmitting(false)
    }
  }

  if (!isModerator) {
    return (
      <div className="page-body">
        <ScreenHeader user={currentUser} balance={balance} onAuthOpen={openAuthModal} />
        <div className="screen-body">
          <div className="admin-restricted">
            <h2>Access Restricted</h2>
            <p>This dashboard is only available to Moderators.</p>
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
          <p className="eyebrow">Moderator Panel</p>
          <h2>Moderation Dashboard</h2>
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

        {/* REPORTS */}
        {activeTab === 'Reports' && !loading && (
          <div className="admin-section">
            <h3 className="admin-section-title">User Reports</h3>
            <div className="admin-inline-form admin-reports-filters">
              <label className="admin-field">
                <span>Type</span>
                <Dropdown
                  value={reportFilter.type}
                  onChange={v => { setReportFilter(p => ({ ...p, type: v })); loadReports({ type: v }) }}
                  options={[
                    { value: '', label: 'All types' },
                    { value: 'user', label: 'User' },
                    { value: 'card', label: 'Card' },
                    { value: 'template', label: 'Template' },
                  ]}
                />
              </label>
              <label className="admin-field">
                <span>Status</span>
                <Dropdown
                  value={reportFilter.status}
                  onChange={v => { setReportFilter(p => ({ ...p, status: v })); loadReports({ status: v }) }}
                  options={[
                    { value: 'open', label: 'Open' },
                    { value: 'reviewed', label: 'Reviewed' },
                    { value: 'resolved', label: 'Resolved' },
                    { value: 'dismissed', label: 'Dismissed' },
                  ]}
                />
              </label>
              <button className="primary" type="button" onClick={() => loadReports()}>Refresh</button>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Type</th><th>Target ID</th><th>Reason</th><th>Details</th><th>Reported by</th><th>Status</th><th>Date</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((rep, i) => (
                    <tr key={rep.reportId || rep._id || i}>
                      <td><span className={`admin-role-chip ${rep.type || 'user'}`}>{rep.type || '—'}</span></td>
                      <td className="admin-cell-mono">{rep.targetId || '—'}</td>
                      <td>{rep.reason || '—'}</td>
                      <td className="admin-cell-details">{rep.details || '—'}</td>
                      <td>{rep.reportedByUsername || rep.reportedById || '—'}</td>
                      <td><span className={`admin-status-chip ${rep.status || 'open'}`}>{rep.status || 'open'}</span></td>
                      <td>{rep.createdAt ? new Date(rep.createdAt).toLocaleDateString() : '—'}</td>
                      <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {rep.status !== 'resolved' && (
                          <button type="button" className="admin-action-btn approve" onClick={() => handleUpdateReportStatus(rep, 'resolved')}>Resolve</button>
                        )}
                        {rep.status !== 'dismissed' && (
                          <button type="button" className="admin-action-btn warn" onClick={() => handleUpdateReportStatus(rep, 'dismissed')}>Dismiss</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {reports.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: 'center', opacity: 0.5 }}>No reports found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* USERS */}
        {activeTab === 'Users' && !loading && (
          <div className="admin-section">
            <h3 className="admin-section-title">User Actions</h3>

            <div className="admin-sub-section">
              <h4>Ban User</h4>
              <div className="admin-inline-form">
                <label className="admin-field">
                  <span>User ID or Username</span>
                  <input placeholder="user id or username" value={banForm.identifier} onChange={e => setBanForm(p => ({ ...p, identifier: e.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>Duration (days)</span>
                  <input type="number" placeholder="7" value={banForm.durationDays} onChange={e => setBanForm(p => ({ ...p, durationDays: Number(e.target.value) }))} />
                </label>
                <label className="admin-field">
                  <span>Reason</span>
                  <input placeholder="Reason for ban" value={banForm.reason} onChange={e => setBanForm(p => ({ ...p, reason: e.target.value }))} />
                </label>
                <button
                  className="primary"
                  type="button"
                  onClick={() => {
                    const id = banForm.identifier.trim()
                    if (!id) { showMsg('User ID or username required.', false); return }
                    setBanConfirm({ identifier: id, payload: { identifier: id, userId: id, durationDays: banForm.durationDays, reason: banForm.reason } })
                  }}
                >
                  Ban
                </button>
              </div>
            </div>

            <div className="admin-sub-section">
              <h4>Unban User</h4>
              <div className="admin-inline-form">
                <label className="admin-field">
                  <span>User ID or Username</span>
                  <input placeholder="user id or username" value={unbanId} onChange={e => setUnbanId(e.target.value)} />
                </label>
                <button className="primary" type="button" onClick={handleUnban}>Unban</button>
              </div>
            </div>
          </div>
        )}

        {/* TEMPLATES */}
        {activeTab === 'Templates' && !loading && (
          <div className="admin-section">
            <h3 className="admin-section-title">Template Management</h3>
            <p className="admin-section-note">Disable templates that violate community guidelines.</p>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Preview</th><th>Name</th><th>Category</th><th>Tier</th><th>Likes</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {templates.map(tpl => (
                    <tr key={tpl.templateId || tpl._id || tpl.id}>
                      <td>
                        {tpl.previewImage
                          ? <img src={tpl.previewImage} alt="" style={{ width: 56, height: 36, objectFit: 'cover', borderRadius: 6 }} />
                          : '—'}
                      </td>
                      <td>{tpl.name || tpl.title || '—'}</td>
                      <td>{tpl.category || '—'}</td>
                      <td>{tpl.tier || '—'}</td>
                      <td>{tpl.likesCount ?? tpl.likes ?? 0}</td>
                      <td>
                        <button
                          type="button"
                          className="admin-action-btn warn"
                          onClick={() => handleDisableTemplate(tpl)}
                        >
                          Disable
                        </button>
                      </td>
                    </tr>
                  ))}
                  {templates.length === 0 && <tr><td colSpan={6}>No templates found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* LOGS */}
        {activeTab === 'Logs' && !loading && (
          <div className="admin-section">
            <h3 className="admin-section-title">My Action Logs</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Action</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={log._id || i}>
                      <td>{log.action || log.type || '—'}</td>
                      <td>{log.statusCode ? <span className={log.statusCode < 400 ? 'admin-status-ok' : 'admin-status-err'}>{log.statusCode}</span> : '—'}</td>
                      <td>{log.createdAt ? new Date(log.createdAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && <tr><td colSpan={3}>No action logs yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* BROADCAST REQUEST */}
        {activeTab === 'Broadcast' && (
          <div className="admin-section">
            <h3 className="admin-section-title">Request Email Broadcast</h3>
            <p className="admin-section-note">
              Submit a message for admin approval. Once approved, it will be emailed to all users.
            </p>
            <div className="admin-broadcast-form">
              <input
                className="admin-broadcast-subject"
                placeholder="Subject line…"
                value={broadcastForm.subject}
                onChange={e => setBroadcastForm(p => ({ ...p, subject: e.target.value }))}
                maxLength={150}
              />
              <textarea
                className="admin-broadcast-textarea"
                placeholder="Message body…"
                value={broadcastForm.message}
                onChange={e => setBroadcastForm(p => ({ ...p, message: e.target.value }))}
                rows={4}
                maxLength={500}
              />
              <div className="admin-broadcast-footer">
                <span className="admin-broadcast-count">{broadcastForm.message.length}/500</span>
                <button
                  className="primary"
                  type="button"
                  onClick={handleBroadcastRequest}
                  disabled={broadcastSubmitting || !broadcastForm.subject.trim() || !broadcastForm.message.trim()}
                >
                  {broadcastSubmitting ? 'Submitting…' : 'Submit for Approval'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CHAT FRAME REQUEST */}
        {activeTab === 'Chat Frames' && (
          <div className="admin-section">
            <h3 className="admin-section-title">Request Chat Frame</h3>
            <p className="admin-section-note">
              Suggest a new chat frame for the store. The admin will review and approve your request.
            </p>
            <div style={{ maxWidth: 480 }}>
              <div className="admin-inline-form" style={{ flexDirection: 'column', gap: 12 }}>
                <label className="admin-field" style={{ width: '100%' }}>
                  <span>Frame Name</span>
                  <input
                    placeholder="e.g. Aurora Glow"
                    value={chatFrameForm.name}
                    onChange={e => setChatFrameForm(p => ({ ...p, name: e.target.value }))}
                    maxLength={50}
                  />
                </label>
                <label className="admin-field" style={{ width: '100%' }}>
                  <span>Frame Image</span>
                  <input
                    ref={chatFrameInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => handleChatFrameFile(e.target.files?.[0])}
                  />
                  <div
                    onClick={() => !chatFrameUploading && chatFrameInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setChatFrameDragOver(true) }}
                    onDragLeave={() => setChatFrameDragOver(false)}
                    onDrop={e => {
                      e.preventDefault()
                      setChatFrameDragOver(false)
                      const file = e.dataTransfer.files?.[0]
                      if (file) handleChatFrameFile(file)
                    }}
                    style={{
                      width: '100%',
                      minHeight: 100,
                      borderRadius: 12,
                      border: `2px dashed ${chatFrameDragOver ? 'rgba(139, 92, 246, 0.6)' : 'rgba(255,255,255,0.15)'}`,
                      background: chatFrameDragOver ? 'rgba(139, 92, 246, 0.08)' : 'rgba(255,255,255,0.03)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 12,
                      cursor: chatFrameUploading ? 'wait' : 'pointer',
                      transition: 'border-color 0.15s, background 0.15s',
                      padding: 12,
                    }}
                  >
                    {chatFrameUploading ? (
                      <span style={{ color: 'rgba(255,255,255,0.6)' }}>Uploading…</span>
                    ) : chatFrameForm.url ? (
                      <>
                        <img src={chatFrameForm.url} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
                        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Uploaded — drag a new image or click to replace</span>
                      </>
                    ) : (
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center' }}>
                        Drag & drop an image here, or click to choose a file
                      </span>
                    )}
                  </div>
                </label>
                {chatFrameForm.url && (
                  <div style={{ width: '100%' }}>
                    <p className="admin-section-note">This is exactly how the frame will wrap a World Chat bubble — art should sit in the outer ~25% of the image with a transparent center.</p>
                    <div className="cf-bubble-wrap">
                      <div className="cf-frame-overlay" style={{ borderImageSource: `url(${chatFrameForm.url})`, borderImageSlice: '33% fill', borderImageWidth: '24px' }} />
                      <div className="cf-bubble-text">Hey! This frame looks great 🔥</div>
                    </div>
                  </div>
                )}
                <label className="admin-field" style={{ width: '100%' }}>
                  <span>Reason / Notes (optional)</span>
                  <textarea
                    placeholder="Why should this frame be added to the store?"
                    value={chatFrameForm.reason}
                    onChange={e => setChatFrameForm(p => ({ ...p, reason: e.target.value }))}
                    rows={3}
                    maxLength={300}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </label>
                <button
                  className="primary"
                  type="button"
                  onClick={handleChatFrameRequest}
                  disabled={chatFrameSubmitting || !chatFrameForm.name.trim() || !chatFrameForm.url.trim()}
                  style={{ width: '100%' }}
                >
                  {chatFrameSubmitting ? 'Submitting…' : 'Submit Frame Request'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <ScreenNav />

      {/* Ban confirmation modal */}
      {banConfirm && (
        <div className="ban-confirm-overlay" role="dialog" aria-modal="true">
          <div className="ban-confirm-backdrop" onClick={() => !banSubmitting && setBanConfirm(null)} />
          <div className="ban-confirm-card">
            <h3 className="ban-confirm-title">Confirm ban</h3>
            <p style={{ color: 'rgba(220,240,247,0.7)', marginBottom: 12 }}>
              Ban <strong>{banConfirm.identifier}</strong> for {banConfirm.payload.durationDays} day(s)?
              {banConfirm.payload.reason && <><br /><em>Reason: {banConfirm.payload.reason}</em></>}
            </p>
            <p className="ban-confirm-warn">This will immediately suspend the account.</p>
            <div className="ban-confirm-actions">
              <button type="button" className="ban-confirm-cancel" onClick={() => setBanConfirm(null)} disabled={banSubmitting}>Cancel</button>
              <button type="button" className="ban-confirm-submit" onClick={handleBan} disabled={banSubmitting}>
                {banSubmitting ? 'Banning…' : 'Confirm ban'}
              </button>
            </div>
          </div>
        </div>
      )}
      {ConfirmModal}
      {statusModal && (
        <StatusModal
          type={statusModal.type}
          message={statusModal.message}
          onClose={() => setStatusModal(null)}
        />
      )}
    </div>
  )
}

export default ModeratorDashboard
