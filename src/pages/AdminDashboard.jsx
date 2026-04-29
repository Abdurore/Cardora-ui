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
  unbanUser,
  setUserRole,
  getAdminReports,
  getModeratorActionLogs,
  disableAdminTemplate,
  approveBroadcastRequest,
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
  updateMediaMusic,
  deleteMediaMusic,
  getAdminTemplates,
  getTemplates,
  approveTemplate,
  rejectTemplate,
} from '../lib/api.js'
import { mapTemplateToCard } from '../lib/backendMappers.js'
import AdminMusicTrack from '../components/AdminMusicTrack.jsx'

const TABS = ['Overview', 'Users', 'Reports', 'Templates', 'Artists', 'Packages', 'Codes', 'Ads', 'Media', 'Coupons', 'Logs']

// Persist trim points locally (backend doesn't store startSec/endSec yet).
// Keyed by track _id OR cloudinary URL so drafts survive before an ID is assigned.
const TRIM_STORE_KEY = 'cardora-music-trim'
function readTrimStore() {
  try { return JSON.parse(localStorage.getItem(TRIM_STORE_KEY) || '{}') } catch { return {} }
}
function writeTrimStore(store) {
  try { localStorage.setItem(TRIM_STORE_KEY, JSON.stringify(store)) } catch {}
}
function mergeTrimData(tracks) {
  const store = readTrimStore()
  return tracks.map((t) => {
    const key = t._id || t.id || t.url || t.audioUrl
    const saved = key && store[key]
    return saved ? { ...t, startSec: saved.startSec, endSec: saved.endSec } : t
  })
}

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
  const [allTemplates, setAllTemplates] = useState([])
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
  // Just-uploaded music clip awaiting trim + save. Holds the Cloudinary URL
  // and a default name; backend POST happens once when the admin clicks Save
  // in the trim editor — no two-step "upload then save" dance.
  const [musicDraft, setMusicDraft] = useState(null) // { url, name } | null
  const mediaVideoInputRef = useRef(null)
  const mediaMusicInputRef = useRef(null)
  // Ban form
  const [banForm, setBanForm] = useState({ identifier: '', durationDays: 7, reason: '' })
  const [banConfirm, setBanConfirm] = useState(null) // { user, payload } | null
  const [banSubmitting, setBanSubmitting] = useState(false)
  // Unban form
  const [unbanIdentifier, setUnbanIdentifier] = useState('')
  // Set role form
  const [roleForm, setRoleForm] = useState({ identifier: '', role: 'moderator' })
  // Reports
  const [reports, setReports] = useState([])
  const [reportFilter, setReportFilter] = useState({ type: '', status: 'open' })
  // Moderator logs
  const [modLogs, setModLogs] = useState([])
  // Broadcast message
  const [broadcastMessage, setBroadcastMessage] = useState('')

  // Whether we're allowed to render the dashboard. Rendered as a guard variable
  // (not an early return) so every hook below — including loadTabData's
  // useEffect — runs on every render. Without this, currentUser flipping from
  // null to Admin during auth hydration changes the hook count between renders
  // and React silently aborts the load effects, leaving the dashboard empty.
  const isAdminGate = currentUser && currentUser.role === 'Admin'

  const showMsg = (text, ok = true) => {
    setActionMsg({ text, ok })
    setTimeout(() => setActionMsg({ text: '', ok: false }), 3000)
  }

  // Backend response shapes drift across endpoints. This helper looks for a
  // list under any of the candidate keys (or returns the body if it's already
  // an array). Returns null if nothing array-shaped is found.
  const pickList = (res, ...keys) => {
    if (!res) return null
    for (const key of keys) {
      if (Array.isArray(res?.[key])) return res[key]
      if (Array.isArray(res?.data?.[key])) return res.data[key]
    }
    if (Array.isArray(res)) return res
    if (Array.isArray(res?.data)) return res.data
    return null
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
          // Try the admin endpoint (returns pending + approved + rejected) AND
          // the public endpoint (live only) in parallel. Merge by id so we
          // surface what we can even if one source is empty or unavailable —
          // most commonly the admin endpoint isn't deployed yet, in which case
          // we still want to show the live marketplace to the admin.
          const [adminRes, publicRes] = await Promise.allSettled([
            getAdminTemplates('page=1&limit=200'),
            getTemplates('page=1&limit=200'),
          ])
          const fromAdmin =
            adminRes.status === 'fulfilled'
              ? (adminRes.value?.data?.templates || adminRes.value?.templates || [])
              : []
          const fromPublic =
            publicRes.status === 'fulfilled'
              ? (publicRes.value?.data?.templates || publicRes.value?.templates || [])
              : []
          if (adminRes.status === 'rejected') {
            console.warn('[Admin] /admin/templates failed, using public list', adminRes.reason)
          }
          // De-dupe by id; admin entries win because they carry status info.
          const seen = new Set()
          const merged = []
          for (const t of [...fromAdmin, ...fromPublic]) {
            const id = t._id || t.templateId || t.id
            if (!id || seen.has(id)) continue
            seen.add(id)
            merged.push(t)
          }
          setAllTemplates(merged.map(mapTemplateToCard))
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
          if (videosRes.status === 'fulfilled') {
            setMediaVideos(pickList(videosRes.value, 'videos', 'items', 'media') || [])
          } else {
            console.warn('[Admin] /media/videos failed', videosRes.reason)
            setMediaVideos([])
          }
          if (musicRes.status === 'fulfilled') {
            const raw = pickList(musicRes.value, 'music', 'tracks', 'items', 'media') || []
            setMediaMusic(mergeTrimData(raw))
          } else {
            console.warn('[Admin] /media/music failed', musicRes.reason)
            setMediaMusic([])
          }
          break
        }
        case 'Reports': {
          const q = `type=${reportFilter.type}&status=${reportFilter.status}&page=1&limit=100`
          const res = await getAdminReports(q)
          setReports(res?.data?.reports || res?.reports || [])
          break
        }
        case 'Logs': {
          const [adminLogsRes, modLogsRes] = await Promise.allSettled([
            getAdminActionLogs(),
            getModeratorActionLogs(),
          ])
          if (adminLogsRes.status === 'fulfilled')
            setLogs(adminLogsRes.value?.data?.logs || adminLogsRes.value?.logs || [])
          if (modLogsRes.status === 'fulfilled')
            setModLogs(modLogsRes.value?.data?.logs || modLogsRes.value?.logs || [])
          break
        }
      }
    } catch (err) {
      console.error(`Admin ${tab} load failed`, err)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!isAdminGate) return
    loadTabData(activeTab)
  }, [activeTab, isAdminGate])

  const handleAcceptApplication = async (appId) => {
    try {
      await acceptArtistApplication(appId)
      showMsg('Application accepted!')
      loadTabData('Templates')
    } catch (err) {
      showMsg(err.message || 'Failed', false)
    }
  }

  const openBanConfirm = () => {
    const id = banForm.identifier.trim()
    if (!id) { showMsg('User ID or username required', false); return }
    const lower = id.toLowerCase()
    const match = users.find(u =>
      (u._id && u._id.toString() === id) ||
      (u.id && u.id.toString() === id) ||
      (u.username && u.username.toLowerCase() === lower)
    )
    setBanConfirm({
      user: match || null,
      identifier: id,
      payload: {
        userId: id,
        durationDays: banForm.durationDays,
        reason: banForm.reason,
      },
    })
  }

  const confirmBanUser = async () => {
    if (!banConfirm) return
    setBanSubmitting(true)
    try {
      await banUser(banConfirm.payload)
      showMsg('User banned.')
      setBanForm({ identifier: '', durationDays: 7, reason: '' })
      setBanConfirm(null)
      loadTabData('Users')
    } catch (err) {
      showMsg(err.message || 'Ban failed', false)
    } finally {
      setBanSubmitting(false)
    }
  }

  const handleUnbanUser = async () => {
    const id = unbanIdentifier.trim()
    if (!id) { showMsg('User ID or username required', false); return }
    if (!window.confirm(`Unban user "${id}"?`)) return
    try {
      await unbanUser({ userId: id })
      showMsg(`User "${id}" unbanned.`)
      setUnbanIdentifier('')
      loadTabData('Users')
    } catch (err) {
      showMsg(err.message || 'Unban failed', false)
    }
  }

  const handleSetRole = async () => {
    const id = roleForm.identifier.trim()
    if (!id) { showMsg('User ID or username required', false); return }
    if (!window.confirm(`Set role "${roleForm.role}" for user "${id}"?`)) return
    try {
      await setUserRole({ userId: id, role: roleForm.role })
      showMsg(`Role updated to "${roleForm.role}".`)
      setRoleForm({ identifier: '', role: 'moderator' })
      loadTabData('Users')
    } catch (err) {
      showMsg(err.message || 'Role update failed', false)
    }
  }

  const handleLoadReports = () => loadTabData('Reports')

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
      // /admin/broadcast-message route returns 404 — backend never deployed it.
      // Reuse the working /admin/send-seasonal-reminder endpoint which already
      // handles "send a custom message to all users" semantics.
      await sendSeasonalReminder({ message: broadcastMessage.trim() })
      showMsg('Broadcast sent to all users!')
      setBroadcastMessage('')
    } catch (err) {
      showMsg(err.message || 'Failed', false)
    }
  }

  const handleMediaVideoFile = async (file) => {
    if (!file) { showMsg('No file selected.', false); return }
    if (!file.type.startsWith('video/')) {
      showMsg(`Please select a video file. Got "${file.type || 'unknown'}".`, false)
      return
    }
    setMediaVideoUploading(true)
    try {
      const url = await uploadToCloudinary(file, 'video')
      // Auto-derive a name from the filename so we can post to the backend
      // immediately. Otherwise users frequently leave the Cloudinary upload
      // hanging without ever clicking "Add", wasting the cloud storage.
      const fallbackName = file.name.replace(/\.[^.]+$/, '').slice(0, 80)
      const finalName = (newVideo.name || '').trim() || fallbackName
      try {
        // Backend validator strictly allows { name, url } — extra fields like
        // `title` or `videoUrl` are rejected with "is not allowed".
        await uploadMediaVideo({ name: finalName, url })
        showMsg('Video added to library!')
        setNewVideo({ name: '', url: '' })
        if (mediaVideoInputRef.current) mediaVideoInputRef.current.value = ''
        await refreshMediaSilent()
      } catch (postErr) {
        console.error('[Admin] uploadMediaVideo POST failed', postErr)
        // Cloudinary URL still in state so the admin can retry without re-uploading.
        setNewVideo({ name: finalName, url })
        showMsg(`Save failed (file uploaded): ${postErr.message || 'unknown error'}`, false)
      }
    } catch (err) {
      console.error('[Admin] Cloudinary video upload failed', err)
      showMsg(`Upload failed: ${err.message || 'unknown error'}`, false)
    } finally {
      setMediaVideoUploading(false)
    }
  }

  const refreshMediaSilent = async () => {
    try {
      const [videosRes, musicRes] = await Promise.allSettled([getMediaVideos(), getMediaMusic()])
      if (videosRes.status === 'fulfilled') {
        const list = pickList(videosRes.value, 'videos', 'items', 'media')
        if (list !== null) setMediaVideos(list)
      } else {
        console.warn('[Admin] getMediaVideos failed', videosRes.reason)
      }
      if (musicRes.status === 'fulfilled') {
        const list = pickList(musicRes.value, 'music', 'tracks', 'items', 'media')
        if (list !== null) setMediaMusic(mergeTrimData(list))
      } else {
        console.warn('[Admin] getMediaMusic failed', musicRes.reason)
      }
    } catch (err) {
      console.error('[Admin] refreshMediaSilent failed', err)
    }
  }

  const handleAddVideo = async () => {
    if (!newVideo.name || !newVideo.url) { showMsg('Name and video required.', false); return }
    try {
      await uploadMediaVideo({ name: newVideo.name, url: newVideo.url })
      showMsg('Video added to library!')
      setNewVideo({ name: '', url: '' })
      if (mediaVideoInputRef.current) mediaVideoInputRef.current.value = ''
      refreshMediaSilent()
    } catch (err) {
      console.error('[Admin] uploadMediaVideo failed', err)
      showMsg(`Save failed: ${err.message || 'unknown error'}`, false)
    }
  }

  const handleDeleteVideo = async (video) => {
    if (!window.confirm('Delete this video?')) return
    const nameKey = video?.nameKey || video?.title || video?.name
    if (!nameKey) { showMsg('Missing video identifier.', false); return }
    try {
      await deleteMediaVideo(nameKey)
      setMediaVideos(prev => prev.filter(v => (v._id || v.id) !== (video._id || video.id)))
      showMsg('Video deleted.')
      refreshMediaSilent()
    } catch (err) {
      showMsg(err.message || 'Delete failed.', false)
    }
  }

  const handleMediaMusicFile = async (file) => {
    if (!file) { showMsg('No file selected.', false); return }
    if (!file.type.startsWith('audio/')) {
      showMsg(`Please select an audio file. Got "${file.type || 'unknown'}".`, false)
      return
    }
    setMediaMusicUploading(true)
    try {
      // Cloudinary stores audio under the `video` resource type — 'auto' can
      // misclassify some codecs and return 4xx. Use 'video' explicitly so mp3
      // and wav uploads work consistently.
      const url = await uploadToCloudinary(file, 'video')
      const defaultName = (newTrack.name || '').trim() ||
        file.name.replace(/\.[^.]+$/, '').slice(0, 80)
      // Park as a draft. The admin will trim + name, then save once.
      setMusicDraft({ url, name: defaultName })
      setNewTrack({ name: '', url: '' })
      if (mediaMusicInputRef.current) mediaMusicInputRef.current.value = ''
      showMsg('Trim and name your clip, then save to the library.')
    } catch (err) {
      console.error('[Admin] Cloudinary audio upload failed', err)
      showMsg(`Upload failed: ${err.message || 'unknown error'}`, false)
    } finally {
      setMediaMusicUploading(false)
    }
  }

  // Single-shot save for a freshly-uploaded clip. The backend's validator
  // currently only accepts { name, url, duration:int } — startSec/endSec are
  // rejected as "not allowed". Until the backend extends the schema, trim
  // metadata is held client-side only (the studio music picker honours it via
  // the in-memory record but it won't survive a page reload).
  const handleSaveDraftTrack = async (draft) => {
    try {
      const startSec = Number(draft.startSec || 0)
      const endSec = Number(draft.endSec || 0)
      const trimmed = endSec > 0 && (startSec > 0 || endSec < Number(draft.duration || 0) - 0.5)
      // Persist trim points keyed by URL so they survive the round-trip to the
      // backend (which doesn't store startSec/endSec yet). After refresh the
      // mergeTrimData pass reattaches them using the same URL key.
      if (trimmed && draft.url) {
        const store = readTrimStore()
        store[draft.url] = { startSec, endSec }
        writeTrimStore(store)
      }
      await uploadMediaMusic({
        name: draft.name,
        url: draft.url,
        duration: Math.round(Number(draft.duration || 0)),
      })
      showMsg(
        trimmed
          ? 'Track added — trim will apply in the studio.'
          : 'Track added to library!',
      )
      setMusicDraft(null)
      await refreshMediaSilent()
    } catch (err) {
      console.error('[Admin] uploadMediaMusic (draft) failed', err)
      showMsg(`Save failed: ${err.message || 'unknown error'}`, false)
      throw err
    }
  }

  const handleDiscardDraft = () => {
    if (!window.confirm('Discard this upload? The Cloudinary file will not be added to the library.')) return
    setMusicDraft(null)
  }

  const handleAddTrack = async () => {
    if (!newTrack.name || !newTrack.url) { showMsg('Name and audio required.', false); return }
    try {
      await uploadMediaMusic({ name: newTrack.name, url: newTrack.url })
      showMsg('Track added to library!')
      setNewTrack({ name: '', url: '' })
      if (mediaMusicInputRef.current) mediaMusicInputRef.current.value = ''
      refreshMediaSilent()
    } catch (err) {
      console.error('[Admin] uploadMediaMusic failed', err)
      showMsg(`Save failed: ${err.message || 'unknown error'}`, false)
    }
  }

  const handleApproveTemplate = async (tpl) => {
    const id = tpl.templateId || tpl.id
    if (!id) return
    try {
      await approveTemplate(id)
      showMsg(`Approved "${tpl.title}".`)
      loadTabData('Templates')
    } catch (err) {
      showMsg(err.message || 'Approve failed.', false)
    }
  }

  const handleRejectTemplate = async (tpl) => {
    const id = tpl.templateId || tpl.id
    if (!id) return
    const reason = window.prompt(`Reject "${tpl.title}"? Optional reason:`, '')
    if (reason === null) return
    try {
      await rejectTemplate(id, reason)
      showMsg(`Rejected "${tpl.title}".`)
      loadTabData('Templates')
    } catch (err) {
      showMsg(err.message || 'Reject failed.', false)
    }
  }

  const handleAdminDeleteTemplate = async (tpl) => {
    const id = tpl.templateId || tpl.id
    if (!id) return
    if (!window.confirm(`Delete template "${tpl.title}"? This cannot be undone.`)) return
    const res = await deleteMarketplaceTemplate?.(id)
    if (res?.ok) {
      showMsg('Template deleted.')
      setAllTemplates(prev => prev.filter(t => (t.templateId || t.id) !== id))
    } else {
      showMsg(res?.message || 'Delete failed.', false)
    }
  }

  const handleSaveTrack = async (updated) => {
    const id = updated._id || updated.id
    if (!id) {
      showMsg('Cannot save: missing track id.', false)
      return
    }
    try {
      // Backend validator currently rejects startSec/endSec. Persist them in
      // localStorage and reattach via mergeTrimData on every list refresh.
      const store = readTrimStore()
      store[id] = {
        startSec: Number(updated.startSec || 0),
        endSec: Number(updated.endSec || 0),
      }
      // Also key by URL so the entry survives if the id changes (edge case).
      const url = updated.url || updated.audioUrl
      if (url) store[url] = store[id]
      writeTrimStore(store)
      await updateMediaMusic(id, {
        name: updated.name,
        duration: Math.round(Number(updated.duration || 0)),
      })
      setMediaMusic((prev) =>
        prev.map((t) => ((t._id || t.id) === id ? { ...t, ...updated } : t)),
      )
      showMsg('Track saved.')
      refreshMediaSilent()
    } catch (err) {
      console.error('[Admin] updateMediaMusic failed', err)
      showMsg(`Save failed: ${err.message || 'unknown error'}`, false)
    }
  }

  const handleDeleteTrack = async (track) => {
    if (!window.confirm('Delete this track?')) return
    const nameKey = track?.nameKey || track?.name || track?.title
    if (!nameKey) { showMsg('Missing track identifier.', false); return }
    try {
      await deleteMediaMusic(nameKey)
      setMediaMusic(prev => prev.filter(t => (t._id || t.id) !== (track._id || track.id)))
      showMsg('Track deleted.')
      refreshMediaSilent()
    } catch (err) {
      showMsg(err.message || 'Delete failed.', false)
    }
  }

  if (!isAdminGate) {
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
                  <span>User ID or Username</span>
                  <input placeholder="user id (24-char) or username" value={banForm.identifier} onChange={e => setBanForm(p => ({ ...p, identifier: e.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>Ban Duration (days)</span>
                  <input type="number" placeholder="7" value={banForm.durationDays} onChange={e => setBanForm(p => ({ ...p, durationDays: Number(e.target.value) }))} />
                </label>
                <label className="admin-field">
                  <span>Reason</span>
                  <input placeholder="Why are they being banned?" value={banForm.reason} onChange={e => setBanForm(p => ({ ...p, reason: e.target.value }))} />
                </label>
                <button className="primary" type="button" onClick={openBanConfirm}>Ban</button>
              </div>
            </div>

            {/* Unban Form */}
            <div className="admin-sub-section">
              <h4>Unban User</h4>
              <div className="admin-inline-form">
                <label className="admin-field">
                  <span>User ID or Username</span>
                  <input
                    placeholder="user id or username"
                    value={unbanIdentifier}
                    onChange={e => setUnbanIdentifier(e.target.value)}
                  />
                </label>
                <button className="primary" type="button" onClick={handleUnbanUser}>Unban</button>
              </div>
            </div>

            {/* Set Role Form */}
            <div className="admin-sub-section">
              <h4>Assign Role</h4>
              <p className="admin-sub-hint">Assignable roles: <code>enterprise</code>, <code>moderator</code></p>
              <div className="admin-inline-form">
                <label className="admin-field">
                  <span>User ID or Username</span>
                  <input
                    placeholder="user id or username"
                    value={roleForm.identifier}
                    onChange={e => setRoleForm(p => ({ ...p, identifier: e.target.value }))}
                  />
                </label>
                <label className="admin-field">
                  <span>Role</span>
                  <select value={roleForm.role} onChange={e => setRoleForm(p => ({ ...p, role: e.target.value }))}>
                    <option value="moderator">Moderator</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </label>
                <button className="primary" type="button" onClick={handleSetRole}>Set Role</button>
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

        {/* REPORTS */}
        {activeTab === 'Reports' && !loading && (
          <div className="admin-section">
            <h3 className="admin-section-title">User Reports</h3>

            <div className="admin-inline-form admin-reports-filters">
              <label className="admin-field">
                <span>Type</span>
                <select value={reportFilter.type} onChange={e => { setReportFilter(p => ({ ...p, type: e.target.value })); }}>
                  <option value="">All types</option>
                  <option value="user">User</option>
                  <option value="card">Card</option>
                  <option value="template">Template</option>
                </select>
              </label>
              <label className="admin-field">
                <span>Status</span>
                <select value={reportFilter.status} onChange={e => { setReportFilter(p => ({ ...p, status: e.target.value })); }}>
                  <option value="open">Open</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="resolved">Resolved</option>
                  <option value="dismissed">Dismissed</option>
                </select>
              </label>
              <button className="primary" type="button" onClick={handleLoadReports}>Filter</button>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Target ID</th>
                    <th>Reason</th>
                    <th>Details</th>
                    <th>Reported by</th>
                    <th>Status</th>
                    <th>Date</th>
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
                    </tr>
                  ))}
                  {reports.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', opacity: 0.5 }}>No reports found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TEMPLATES — review & delete */}
        {activeTab === 'Templates' && !loading && (() => {
          const pending = allTemplates.filter(t => t.status === 'pending')
          const live = allTemplates.filter(t => t.status === 'approved' || t.status === 'live' || !t.status || t.status === '')
          const rejected = allTemplates.filter(t => t.status === 'rejected')

          const renderTable = (rows, showReviewActions) => (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Preview</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Tier</th>
                    <th>Likes</th>
                    <th>Views</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((tpl) => (
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
                      <td>{tpl.type || '-'}</td>
                      <td>{tpl.tier || '-'}</td>
                      <td>{tpl.likeCount ?? tpl.likes ?? 0}</td>
                      <td>{tpl.userCount ?? 0}</td>
                      <td>
                        <span className={`admin-template-status ${(tpl.status || 'live').toLowerCase()}`}>
                          {tpl.tag || 'Live'}
                        </span>
                      </td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        {showReviewActions && (
                          <>
                            <button
                              type="button"
                              className="admin-action-btn accept"
                              onClick={() => handleApproveTemplate(tpl)}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="admin-action-btn reject"
                              onClick={() => handleRejectTemplate(tpl)}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="admin-action-btn warn"
                          onClick={async () => {
                            const id = tpl.templateId || tpl.id
                            if (!id) return
                            if (!window.confirm(`Disable template "${tpl.title}"?`)) return
                            try { await disableAdminTemplate(id); showMsg('Template disabled.'); loadTabData('Templates') }
                            catch (err) { showMsg(err.message || 'Disable failed', false) }
                          }}
                        >
                          Disable
                        </button>
                        <button
                          type="button"
                          className="admin-action-btn reject"
                          onClick={() => handleAdminDeleteTemplate(tpl)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )

          return (
            <>
              <div className="admin-section">
                <h3 className="admin-section-title">
                  Pending Review {pending.length > 0 ? `(${pending.length})` : ''}
                </h3>
                {pending.length > 0 ? renderTable(pending, true) : (
                  <div className="admin-empty">
                    <span className="admin-empty-icon">{"\u{1F4E5}"}</span>
                    <p>No templates awaiting review.</p>
                  </div>
                )}
              </div>

              <div className="admin-section">
                <h3 className="admin-section-title">
                  Live Marketplace {live.length > 0 ? `(${live.length})` : ''}
                </h3>
                {live.length > 0 ? renderTable(live, false) : (
                  <div className="admin-empty">
                    <span className="admin-empty-icon">{"\u{1F4C4}"}</span>
                    <p>No approved templates in the marketplace yet.</p>
                  </div>
                )}
              </div>

              {rejected.length > 0 && (
                <div className="admin-section">
                  <h3 className="admin-section-title">Rejected ({rejected.length})</h3>
                  {renderTable(rejected, false)}
                </div>
              )}
            </>
          )
        })()}

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
                    <span>Video Name <small>(optional — defaults to filename)</small></span>
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
                      <><span>✓</span> Replace file</>
                    ) : (
                      <><span className="admin-media-file-icon">↑</span> Upload &amp; save</>
                    )}
                  </button>
                  {newVideo.url && (
                    <button
                      className="primary admin-media-add-btn"
                      type="button"
                      onClick={handleAddVideo}
                      disabled={mediaVideoUploading || !newVideo.name.trim()}
                      title="Retry saving the previous upload"
                    >
                      Retry save
                    </button>
                  )}
                </div>
                <p className="admin-media-hint">Files save to the library automatically once uploaded.</p>
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
                        <span className="admin-media-video-title">{v.title || v.name || 'Untitled'}</span>
                        <button
                          type="button"
                          className="admin-media-delete-btn"
                          onClick={() => handleDeleteVideo(v)}
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

              {/* Upload form — hidden while a draft is being trimmed so the
                  admin focuses on saving the current clip first. */}
              {!musicDraft && (
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
                      <span>Track Name <small>(optional — defaults to filename)</small></span>
                      <input
                        placeholder="e.g. Soft Piano"
                        value={newTrack.name}
                        onChange={e => setNewTrack(p => ({ ...p, name: e.target.value }))}
                      />
                    </label>
                    <button
                      type="button"
                      className={`admin-media-file-btn${mediaMusicUploading ? ' uploading' : ''}`}
                      onClick={() => !mediaMusicUploading && mediaMusicInputRef.current?.click()}
                      disabled={mediaMusicUploading}
                    >
                      {mediaMusicUploading ? (
                        <><span className="admin-media-file-spinner" />Uploading…</>
                      ) : (
                        <><span className="admin-media-file-icon">↑</span> Upload audio</>
                      )}
                    </button>
                  </div>
                  <p className="admin-media-hint">Pick a file → trim &amp; name → save once.</p>
                </div>
              )}

              {/* Draft editor — shown while a freshly-uploaded clip awaits trim+save */}
              {musicDraft && (
                <div className="admin-media-draft-wrap">
                  <div className="admin-media-draft-banner">
                    <span>New upload — set the play span, then save it once.</span>
                    <button type="button" className="admin-media-draft-discard" onClick={handleDiscardDraft}>
                      Discard
                    </button>
                  </div>
                  <AdminMusicTrack
                    mode="draft"
                    track={musicDraft}
                    onSave={handleSaveDraftTrack}
                    onDelete={handleDiscardDraft}
                  />
                </div>
              )}

              {/* Music list — themed editor with playback + trim controls */}
              {mediaMusic.length > 0 ? (
                <div className="admin-media-music-list">
                  {mediaMusic.map(track => (
                    <AdminMusicTrack
                      key={track._id || track.id}
                      track={track}
                      onSave={handleSaveTrack}
                      onDelete={handleDeleteTrack}
                    />
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
            <h3 className="admin-section-title">Admin Action Logs</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Actor</th><th>Role</th><th>Action</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={log._id || i}>
                      <td>{log.actorUsername || log.adminId || log.admin || '—'}</td>
                      <td><span className={`admin-role-chip ${(log.actorRole || 'admin').toLowerCase()}`}>{log.actorRole || 'Admin'}</span></td>
                      <td>{log.action || log.type || '—'}</td>
                      <td>{log.statusCode ? <span className={log.statusCode < 400 ? 'admin-status-ok' : 'admin-status-err'}>{log.statusCode}</span> : '—'}</td>
                      <td>{log.createdAt ? new Date(log.createdAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && <tr><td colSpan={5}>No admin logs yet.</td></tr>}
                </tbody>
              </table>
            </div>

            <h3 className="admin-section-title" style={{ marginTop: 32 }}>Moderator Action Logs</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Moderator</th><th>Action</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {modLogs.map((log, i) => (
                    <tr key={log._id || i}>
                      <td>{log.actorUsername || log.moderatorId || log.actor || '—'}</td>
                      <td>{log.action || log.type || '—'}</td>
                      <td>{log.statusCode ? <span className={log.statusCode < 400 ? 'admin-status-ok' : 'admin-status-err'}>{log.statusCode}</span> : '—'}</td>
                      <td>{log.createdAt ? new Date(log.createdAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                  {modLogs.length === 0 && <tr><td colSpan={4}>No moderator logs yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <ScreenNav />

      {banConfirm && (
        <div className="ban-confirm-overlay" role="dialog" aria-modal="true">
          <div className="ban-confirm-backdrop" onClick={() => !banSubmitting && setBanConfirm(null)} />
          <div className="ban-confirm-card">
            <h3 className="ban-confirm-title">Confirm ban</h3>
            {banConfirm.user ? (
              <div className="ban-confirm-user">
                <div className="ban-confirm-avatar">
                  {banConfirm.user.profilePictureUrl
                    ? <img src={banConfirm.user.profilePictureUrl} alt={banConfirm.user.username || ''} />
                    : <span>{(banConfirm.user.username || '?').slice(0, 1).toUpperCase()}</span>}
                </div>
                <div className="ban-confirm-info">
                  <div className="ban-confirm-username">{banConfirm.user.username || '—'}</div>
                  <div className="ban-confirm-email">{banConfirm.user.email || '—'}</div>
                  <div className="ban-confirm-meta">
                    <span className={`admin-role-chip ${(banConfirm.user.role || 'user').toLowerCase()}`}>{banConfirm.user.role || 'User'}</span>
                    <span>CC: {banConfirm.user.cc ?? banConfirm.user.balance ?? 0}</span>
                    <span>{banConfirm.user.isVerified ? 'Verified' : 'Unverified'}</span>
                  </div>
                  {(banConfirm.user._id || banConfirm.user.id) && (
                    <div className="ban-confirm-id">ID: {banConfirm.user._id || banConfirm.user.id}</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="ban-confirm-user ban-confirm-user-missing">
                <p>No matching user found in the loaded list. The ban will still be attempted using this value:</p>
                <code>{banConfirm.identifier}</code>
              </div>
            )}

            <div className="ban-confirm-details">
              <div><span>Duration</span><strong>{banConfirm.payload.durationDays} day(s)</strong></div>
              <div><span>Reason</span><strong>{banConfirm.payload.reason || '—'}</strong></div>
            </div>

            <p className="ban-confirm-warn">This will immediately suspend the account. Proceed?</p>

            <div className="ban-confirm-actions">
              <button
                type="button"
                className="ban-confirm-cancel"
                onClick={() => setBanConfirm(null)}
                disabled={banSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ban-confirm-submit"
                onClick={confirmBanUser}
                disabled={banSubmitting}
              >
                {banSubmitting ? 'Banning…' : 'Confirm ban'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard


