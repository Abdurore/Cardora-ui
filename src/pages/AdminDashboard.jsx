import { useOutletContext, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { uploadToCloudinary } from '../lib/cloudinary.js'
import { trimAudioFile, getAudioDuration } from '../lib/audioTrim.js'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import Dropdown from '../components/Dropdown.jsx'
import StatusModal from '../components/StatusModal.jsx'
import { useAppConfirm } from '../hooks/useAppConfirm.jsx'
import {
  getAdminDashboard,
  getAdminStatsUsers,
  getAdminStatsCards,
  getAdminStatsTemplates,
  getAdminStatsOverview,
  getAdminUsers,
  banUser,
  unbanUser,
  setUserRole,
  getAdminReports,
  updateAdminReportStatus,
  getModeratorActionLogs,
  disableAdminTemplate,
  enableAdminTemplate,
  adminDeleteTemplate,
  approveBroadcastRequest,
  rejectBroadcastRequest,
  getBroadcastRequests,
  getAdminPackages,
  createAdminPackage,
  deleteAdminPackage,
  getAdminRedeemCodes,
  createAdminRedeemCode,
  disableAdminRedeemCode,
  enableAdminRedeemCode,
  deleteAdminRedeemCode,
  getAdminAds,
  createAdminAd,
  updateAdminAd,
  deleteAdminAd,
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
  getProfileBackgrounds,
  createProfileBackground,
  deleteProfileBackground,
  getAdminTemplates,
  getTemplates,
  approveTemplate,
  rejectTemplate,
  getSignupBonusStatus,
  resetSignupBonus,
  createChatFrame,
  deleteChatFrame,
  forgetCachedChatFrame,
  approveChatFrameRequest,
  rejectChatFrameRequest,
  getChatFrameRequests,
  rememberChatFrame,
  createAdminGift,
  getAdminGifts,
  deleteAdminGift,
  getBroadcastDeliveryLogs,
  getAdminChatFrames,
  getChatFrames,
  getCachedChatFrames,
} from '../lib/api.js'
import { mapTemplateToCard } from '../lib/backendMappers.js'
import { getChatFrameId, getChatFrameUrl, normalizeChatFrame } from '../lib/chatFrames.js'
import AdminMusicTrack from '../components/AdminMusicTrack.jsx'

const TABS = ['Overview', 'Users', 'Reports', 'Templates', 'Packages', 'Codes', 'Ads', 'Media', 'Gifts', 'Coupons', 'Logs']
const TEMPLATE_DISABLE_DAYS = 7

// The 10 built-in gift "types" — each is a hand-designed heart color/reveal
// animation (see PremiumGiftReveal.jsx's EFFECTS). A new custom gift picks
// one of these to inherit its visuals rather than needing new animation assets.
const GIFT_EFFECT_OPTIONS = [
  { value: 'tiny', label: 'Tiny Heart — Gray', color: 'Gray' },
  { value: 'sweet', label: 'Sweet Heart — Pink', color: 'Pink' },
  { value: 'purple', label: 'Purple Love — Purple', color: 'Purple' },
  { value: 'ocean', label: 'Ocean Heart — Blue', color: 'Blue' },
  { value: 'emerald', label: 'Emerald Heart — Green', color: 'Green' },
  { value: 'passion', label: 'Passion Heart — Red', color: 'Red' },
  { value: 'golden', label: 'Golden Heart — Gold', color: 'Gold' },
  { value: 'crystal', label: 'Crystal Heart — Cyan', color: 'Cyan' },
  { value: 'diamond', label: 'Diamond Heart — Silver', color: 'Silver' },
  { value: 'legendary', label: 'Legendary Heart — Rainbow', color: 'Rainbow' },
]
const GIFT_TIER_OPTIONS = ['common', 'rare', 'epic', 'legendary', 'mythic']

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

// Client-side pagination helper. `data` is the full array; returns the
// sliced page along with controls to render the page indicator.
function usePagination(data, pageSize = 20) {
  const [page, setPage] = useState(1)
  const total = data?.length || 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  // Clamp page if data shrinks (e.g. after a delete).
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])
  const pagedData = (data || []).slice((page - 1) * pageSize, page * pageSize)
  return { pagedData, page, setPage, totalPages, total, pageSize }
}

function TablePagination({ page, setPage, totalPages, total, pageSize }) {
  if (totalPages <= 1) return null
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  return (
    <div className="admin-pagination">
      <span className="admin-pagination-info">
        Showing {start}–{end} of {total}
      </span>
      <div className="admin-pagination-controls">
        <button
          type="button"
          className="admin-pagination-btn"
          onClick={() => setPage(1)}
          disabled={page === 1}
        >« First</button>
        <button
          type="button"
          className="admin-pagination-btn"
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
        >‹ Prev</button>
        <span className="admin-pagination-page">Page {page} of {totalPages}</span>
        <button
          type="button"
          className="admin-pagination-btn"
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
        >Next ›</button>
        <button
          type="button"
          className="admin-pagination-btn"
          onClick={() => setPage(totalPages)}
          disabled={page === totalPages}
        >Last »</button>
      </div>
    </div>
  )
}

function AdminDashboard() {
  const { currentUser, balance, openAuthModal, marketplaceTemplates, deleteMarketplaceTemplate } = useOutletContext()
  const navigate = useNavigate()
  const { confirm: appConfirm, ConfirmModal } = useAppConfirm()
  const [statusModal, setStatusModal] = useState(null) // { type, title?, message }
  const [activeTab, setActiveTab] = useState('Overview')
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [packages, setPackages] = useState([])
  const [redeemCodes, setRedeemCodes] = useState([])
  const [ads, setAds] = useState([])
  const [adsAnalytics, setAdsAnalytics] = useState(null)
  const [logs, setLogs] = useState([])
  const [coupons, setCoupons] = useState([])
  const [referralStats, setReferralStats] = useState(null)
  const [mediaVideos, setMediaVideos] = useState([])
  const [mediaMusic, setMediaMusic] = useState([])
  const [profileBackgrounds, setProfileBackgrounds] = useState([])
  const [allTemplates, setAllTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [signupBonus, setSignupBonus] = useState(null)
  const [adminChatFrames, setAdminChatFrames] = useState([])
  const [newChatFrame, setNewChatFrame] = useState({ id: '', name: '', url: '', price: 5 })
  const [chatFrameUploading, setChatFrameUploading] = useState(false)
  const [adminGifts, setAdminGifts] = useState([])
  const [newGift, setNewGift] = useState({ name: '', priceNgn: 500, effectKey: 'tiny', tier: 'common' })
  const [deliveryLogs, setDeliveryLogs] = useState([])
  const [deliveryBroadcastId, setDeliveryBroadcastId] = useState('')
  const [pendingBroadcastRequests, setPendingBroadcastRequests] = useState([])
  const [pendingChatFrameRequests, setPendingChatFrameRequests] = useState([])

  // New package form
  const [newPkg, setNewPkg] = useState({ name: '', description: '', numberOfCC: 20, price: 9.99, isActive: true, featured: false })
  // New redeem code form
  const [newCode, setNewCode] = useState({ numberOfCC: 10, maxUses: 200, isActive: true })
  // New ad form
  const [newAd, setNewAd] = useState({ name: '', type: 'external', enterpriseId: '', enterpriseName: '', videoUrl: '', linkUrl: '', rewardCC: 2, duration: 30, maxViews: '', isActive: true, priority: 1, active: true })
  // Broadcast subject
  const [broadcastSubject, setBroadcastSubject] = useState('')
  const [adVideoUploading, setAdVideoUploading] = useState(false)
  const [adVideoDragOver, setAdVideoDragOver] = useState(false)
  const adVideoInputRef = useRef(null)
  // Media library forms
  const [newVideo, setNewVideo] = useState({ name: '', url: '' })
  const [newTrack, setNewTrack] = useState({ name: '', url: '' })
  const [newProfileBg, setNewProfileBg] = useState({ name: '', url: '' })
  const [mediaVideoUploading, setMediaVideoUploading] = useState(false)
  const [mediaMusicUploading, setMediaMusicUploading] = useState(false)
  const [profileBgUploading, setProfileBgUploading] = useState(false)
  // Just-uploaded music clip awaiting trim + save. Holds the Cloudinary URL
  // and a default name; backend POST happens once when the admin clicks Save
  // in the trim editor — no two-step "upload then save" dance.
  const [musicDraft, setMusicDraft] = useState(null) // { url, name } | null
  const mediaVideoInputRef = useRef(null)
  const mediaMusicInputRef = useRef(null)
  const profileBgInputRef = useRef(null)
  const chatFrameInputRef = useRef(null)
  // Ban form
  const [banForm, setBanForm] = useState({ identifier: '', durationDays: 7, reason: '' })
  const [banConfirm, setBanConfirm] = useState(null) // { user, payload } | null
  const [banSubmitting, setBanSubmitting] = useState(false)
  // Unban form
  const [unbanIdentifier, setUnbanIdentifier] = useState('')
  // Set role form
  const [roleForm, setRoleForm] = useState({ identifier: '', role: 'moderator' })
  const [roleConfirm, setRoleConfirm] = useState(null) // { user, identifier, role } | null
  const [roleSubmitting, setRoleSubmitting] = useState(false)
  const [roleError, setRoleError] = useState('')
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
  const isAdminGate = currentUser && String(currentUser.role || '').toLowerCase() === 'admin'

  // Pagination state for long admin tables
  const usersPaging = usePagination(users, 20)
  const reportsPaging = usePagination(reports, 20)
  const adsPaging = usePagination(ads, 20)
  const couponsPaging = usePagination(coupons, 20)
  const logsPaging = usePagination(logs, 25)
  const modLogsPaging = usePagination(modLogs, 25)
  const allTemplatesPaging = usePagination(allTemplates, 20)
  const pagedUsers = usersPaging.pagedData
  const pagedReports = reportsPaging.pagedData
  const pagedAds = adsPaging.pagedData
  const enterpriseUsers = users.filter(user => String(user.role || '').toLowerCase() === 'enterprise')
  const pagedCoupons = couponsPaging.pagedData
  const pagedLogs = logsPaging.pagedData
  const pagedModLogs = modLogsPaging.pagedData
  const pagedAllTemplates = allTemplatesPaging.pagedData

  const showMsg = (text, ok = true) => {
    setStatusModal({ type: ok ? 'success' : 'error', message: text })
  }

  // Backend response shapes drift across endpoints. This helper looks for a
  // list under any of the candidate keys (or returns the body if it's already
  // an array). Returns null if nothing array-shaped is found.
  const pickList = (res, ...keys) => {
    if (!res) return null
    for (const key of keys) {
      if (Array.isArray(res?.[key])) return res[key]
      if (Array.isArray(res?.data?.[key])) return res.data[key]
      if (Array.isArray(res?.data?.[key]?.docs)) return res.data[key].docs
      if (Array.isArray(res?.data?.[key]?.items)) return res.data[key].items
      if (Array.isArray(res?.result?.[key])) return res.result[key]
      if (Array.isArray(res?.result?.[key]?.docs)) return res.result[key].docs
      if (Array.isArray(res?.result?.[key]?.items)) return res.result[key].items
    }
    if (Array.isArray(res)) return res
    if (Array.isArray(res?.data)) return res.data
    if (Array.isArray(res?.data?.docs)) return res.data.docs
    if (Array.isArray(res?.data?.items)) return res.data.items
    if (Array.isArray(res?.results)) return res.results
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
          try {
            const bonusRes = await getSignupBonusStatus()
            setSignupBonus(bonusRes?.data || bonusRes || null)
          } catch { setSignupBonus(null) }
          try {
            const reqRes = await getBroadcastRequests()
            setPendingBroadcastRequests(reqRes?.data?.requests || reqRes?.requests || [])
          } catch { setPendingBroadcastRequests([]) }
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
          const pickList = (res) => {
            const d = res?.data ?? res
            if (Array.isArray(d?.templates)) return d.templates
            if (Array.isArray(d?.items)) return d.items
            if (Array.isArray(d)) return d
            if (Array.isArray(res?.templates)) return res.templates
            return []
          }
          const fromAdmin =
            adminRes.status === 'fulfilled'
              ? pickList(adminRes.value)
              : []
          const fromPublic =
            publicRes.status === 'fulfilled'
              ? pickList(publicRes.value)
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
          const [adsRes, analyticsRes, usersRes] = await Promise.allSettled([getAdminAds(), getAdminAdsAnalytics(), getAdminUsers()])
          const adsData = adsRes.status === 'fulfilled' ? (adsRes.value?.data?.ads || adsRes.value?.ads || []) : []
          if (adsRes.status === 'fulfilled') setAds(adsData)
          if (analyticsRes.status === 'fulfilled') {
            const raw = analyticsRes.value?.data || analyticsRes.value
            setAdsAnalytics(raw?.analytics || raw?.stats || raw || null)
          } else {
            // Fallback: compute aggregate analytics from individual ad objects
            if (adsData.length > 0) {
              const totalViews = adsData.reduce((s, a) => s + (a.currentViews ?? a.views ?? 0), 0)
              const totalClicks = adsData.reduce((s, a) => s + (a.clicks ?? a.clickCount ?? 0), 0)
              const totalCompletions = adsData.reduce((s, a) => s + (a.completions ?? a.completed ?? 0), 0)
              const totalCCPaid = adsData.reduce((s, a) => s + ((a.completions ?? a.completed ?? 0) * (a.rewardCC ?? 2)), 0)
              setAdsAnalytics({ totalViews, totalClicks, totalCompletions, totalCCPaid, uniqueUsers: 0 })
            }
          }
          if (usersRes.status === 'fulfilled') setUsers(usersRes.value?.data?.users || usersRes.value?.users || [])
          break
        }
        case 'Media': {
          const [videosRes, musicRes, profileBgRes] = await Promise.allSettled([getMediaVideos(), getMediaMusic(), getProfileBackgrounds()])
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
          if (profileBgRes.status === 'fulfilled') {
            setProfileBackgrounds(pickList(profileBgRes.value, 'backgrounds', 'profileBackgrounds', 'items', 'media') || [])
          } else {
            console.warn('[Admin] /admin/profile-backgrounds failed', profileBgRes.reason)
            setProfileBackgrounds([])
          }
          break
        }
        case 'Reports': {
          const params = new URLSearchParams({ page: '1', limit: '100' })
          if (reportFilter.type) params.append('type', reportFilter.type)
          if (reportFilter.status) params.append('status', reportFilter.status)
          
          const [reportsRes, templatesRes] = await Promise.allSettled([
            getAdminReports(params.toString()),
            getAdminTemplates('page=1&limit=200').catch(() => getTemplates('page=1&limit=200')),
          ])
          
          if (reportsRes.status === 'fulfilled') {
            const res = reportsRes.value
            setReports(res?.data?.reports || res?.reports || [])
          }
          if (templatesRes.status === 'fulfilled') {
            const res = templatesRes.value
            const d = res?.data ?? res
            const list = Array.isArray(d?.templates) ? d.templates : (Array.isArray(d?.items) ? d.items : (Array.isArray(d) ? d : []))
            setAllTemplates(list.map(mapTemplateToCard))
          }
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
        case 'Gifts': {
          const [giftsRes, framesRes] = await Promise.allSettled([getAdminGifts(), getAdminChatFrames().catch(() => getChatFrames())])
          if (giftsRes.status === 'fulfilled') {
            const list = giftsRes.value?.data?.gifts || giftsRes.value?.gifts || giftsRes.value?.data || []
            setAdminGifts(Array.isArray(list) ? list : [])
          }
          if (framesRes.status === 'fulfilled') {
            const list = pickList(framesRes.value, 'chatFrames', 'frames', 'items') || []
            const frames = [...list, ...getCachedChatFrames()]
              .map(normalizeChatFrame)
              .filter(Boolean)
            const seen = new Set()
            setAdminChatFrames(frames.filter(frame => {
              if (seen.has(frame.id)) return false
              seen.add(frame.id)
              return true
            }))
          } else {
            setAdminChatFrames(getCachedChatFrames().map(normalizeChatFrame).filter(Boolean))
          }
          try {
            const reqRes = await getChatFrameRequests()
            setPendingChatFrameRequests(reqRes?.data?.requests || reqRes?.requests || [])
          } catch { setPendingChatFrameRequests([]) }
          break
        }
      }
    } catch (err) {
      console.error(`Admin ${tab} load failed`, err)
    }
    setLoading(false)
  }

  // Reset every tab-scoped state slice on an actual identity change (not on
  // every plain tab switch, which already re-fetches its own tab's data) so
  // a previous admin account's data never lingers on screen under a new
  // session — covers every tab, not just whichever was active at the moment
  // of switching, since the admin could land back on any of them.
  const adminIdentityRef = useRef(currentUser?.id)
  useEffect(() => {
    if (adminIdentityRef.current === currentUser?.id) return
    adminIdentityRef.current = currentUser?.id
    setStats(null)
    setReferralStats(null)
    setSignupBonus(null)
    setPendingBroadcastRequests([])
    setCoupons([])
    setUsers([])
    setAllTemplates([])
    setPackages([])
    setRedeemCodes([])
    setAds([])
    setAdsAnalytics(null)
    setMediaVideos([])
    setMediaMusic([])
    setProfileBackgrounds([])
    setReports([])
    setLogs([])
    setModLogs([])
    setAdminGifts([])
    setAdminChatFrames([])
    setPendingChatFrameRequests([])
  }, [currentUser?.id])

  useEffect(() => {
    if (!isAdminGate) return
    loadTabData(activeTab)
  }, [activeTab, isAdminGate, currentUser?.id])

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
        identifier: id,
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
    if (!await appConfirm('Unban User', `Unban "${id}"?`)) return
    try {
      await unbanUser({ identifier: id, userId: id })
      showMsg(`User "${id}" unbanned.`)
      setUnbanIdentifier('')
      loadTabData('Users')
    } catch (err) {
      showMsg(err.message || 'Unban failed', false)
    }
  }

  const openRoleConfirm = (identifierOverride, roleOverride) => {
    const id = (identifierOverride || roleForm.identifier).trim()
    const role = roleOverride || roleForm.role
    if (!id) { showMsg('User ID or username required', false); return }
    const matchedUser = users.find(u =>
      (u._id || u.id) === id || u.username === id || u.name === id
    ) || null
    setRoleConfirm({ user: matchedUser, identifier: id, role })
  }

  const confirmSetRole = async () => {
    if (!roleConfirm) return
    setRoleSubmitting(true)
    setRoleError('')
    try {
      await setUserRole({ identifier: roleConfirm.identifier, userId: roleConfirm.identifier, role: roleConfirm.role })
      showMsg(`Role updated to "${roleConfirm.role}".`)
      setRoleForm({ identifier: '', role: 'moderator' })
      setRoleConfirm(null)
      loadTabData('Users')
    } catch (err) {
      setRoleError(err.message || 'Role update failed. Check the user ID and try again.')
      showMsg(err.message || 'Role update failed', false)
    }
    setRoleSubmitting(false)
  }

  const handleLoadReports = async (overrides = {}) => {
    const f = { ...reportFilter, ...overrides }
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: '1', limit: '100' })
      if (f.type) params.append('type', f.type)
      if (f.status) params.append('status', f.status)
      const res = await getAdminReports(params.toString())
      setReports(res?.data?.reports || res?.reports || [])
    } catch (err) {
      console.error('Reports load failed', err)
    }
    setLoading(false)
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

  const handleDeleteAd = async (ad) => {
    if (!await appConfirm('Delete Ad', `Delete "${ad.name || 'this ad'}"? This cannot be undone.`, { variant: 'danger', confirmLabel: 'Delete' })) return
    const id = ad._id || ad.id
    try {
      await deleteAdminAd(id)
      showMsg('Ad deleted.')
      setAds(prev => prev.filter(a => (a._id || a.id) !== id))
    } catch (err) {
      showMsg(err.message || 'Delete failed.', false)
    }
  }

  const handleDisableCode = async (code) => {
    if (!await appConfirm('Disable Code', `Disable code "${code.code}"?`, { variant: 'warning', confirmLabel: 'Disable' })) return
    try {
      await disableAdminRedeemCode(code.code)
      showMsg('Code disabled.')
      loadTabData('Codes')
    } catch (err) {
      showMsg(err.message || 'Disable failed.', false)
    }
  }

  const handleEnableCode = async (code) => {
    try {
      await enableAdminRedeemCode(code.code)
      showMsg('Code enabled.')
      loadTabData('Codes')
    } catch (err) {
      showMsg(err.message || 'Enable failed.', false)
    }
  }

  const handleDeleteCode = async (code) => {
    if (!await appConfirm('Delete Code', `Delete code "${code.code}"? This cannot be undone.`, { variant: 'danger', confirmLabel: 'Delete' })) return
    try {
      await deleteAdminRedeemCode(code.code)
      showMsg('Code deleted.')
      setRedeemCodes(prev => prev.filter(c => c.code !== code.code))
    } catch (err) {
      showMsg(err.message || 'Delete failed.', false)
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
      const payload = { ...newAd }
      if (!payload.linkUrl) delete payload.linkUrl
      if (payload.enterpriseName) {
        payload.enterpriseAccountUsername = payload.enterpriseName
      }
      delete payload.enterpriseId
      delete payload.enterpriseName
      if (!payload.enterpriseAccountUsername) delete payload.enterpriseAccountUsername
      if (!payload.maxViews) delete payload.maxViews
      else payload.maxViews = Number(payload.maxViews)
      await createAdminAd(payload)
      showMsg('Ad created!')
      setNewAd({ name: '', type: 'external', enterpriseId: '', enterpriseName: '', videoUrl: '', linkUrl: '', rewardCC: 2, duration: 30, maxViews: '', isActive: true, priority: 1, active: true })
      if (adVideoInputRef.current) adVideoInputRef.current.value = ''
      loadTabData('Ads')
    } catch (err) {
      showMsg(err.message || 'Failed', false)
    }
  }

const handleBroadcast = async () => {
    if (!broadcastMessage.trim()) { showMsg('Message cannot be empty.', false); return }
    if (!broadcastSubject.trim()) { showMsg('Subject line is required.', false); return }
    try {
      await sendSeasonalReminder({ subject: broadcastSubject.trim(), message: broadcastMessage.trim() })
      showMsg('Broadcast sent to all users!')
      setBroadcastMessage('')
      setBroadcastSubject('')
    } catch (err) {
      showMsg(err.message || 'Failed', false)
    }
  }

  const handleResetSignupBonus = async () => {
    if (!await appConfirm('Reset Signup Bonus', 'Reset the signup bonus counter?', { variant: 'warning', confirmLabel: 'Reset' })) return
    try {
      await resetSignupBonus()
      showMsg('Signup bonus counter reset.')
      const bonusRes = await getSignupBonusStatus()
      setSignupBonus(bonusRes?.data || bonusRes || null)
    } catch (err) { showMsg(err.message || 'Reset failed.', false) }
  }

  const handleCreateChatFrame = async () => {
    if (!newChatFrame.name.trim() || !newChatFrame.url.trim()) { showMsg('Name and URL required.', false); return }
    try {
      const payload = { id: newChatFrame.id.trim() || `frame_${Date.now()}`, name: newChatFrame.name.trim(), url: newChatFrame.url.trim(), imageUrl: newChatFrame.url.trim(), price: Number(newChatFrame.price) || 5 }
      await createChatFrame(payload)
      rememberChatFrame(payload)
      showMsg('Chat frame created!')
      setNewChatFrame({ id: '', name: '', url: '', price: 5 })
      if (chatFrameInputRef.current) chatFrameInputRef.current.value = ''
      loadTabData('Gifts')
    } catch (err) { showMsg(err.message || 'Failed.', false) }
  }

  const handleChatFrameFile = async (file) => {
    if (!file) { showMsg('No file selected.', false); return }
    if (!file.type.startsWith('image/')) {
      showMsg(`Please select an image file. Got "${file.type || 'unknown'}".`, false)
      return
    }
    setChatFrameUploading(true)
    try {
      const url = await uploadToCloudinary(file, 'image')
      const fallbackName = file.name.replace(/\.[^.]+$/, '').slice(0, 80)
      setNewChatFrame(p => ({ ...p, name: p.name || fallbackName, url }))
      showMsg('Frame image uploaded. Add a price, then create the frame.')
    } catch (err) {
      showMsg(err.message || 'Frame upload failed.', false)
    } finally {
      setChatFrameUploading(false)
    }
  }

  const handleDeleteChatFrame = async (frame) => {
    const fid = getChatFrameId(frame)
    if (!fid) { showMsg('Missing frame identifier.', false); return }
    if (!await appConfirm('Delete Frame', `Delete "${frame.name || fid}"?`, { variant: 'danger', confirmLabel: 'Delete' })) return
    try {
      await deleteChatFrame(fid)
      forgetCachedChatFrame(fid)
      showMsg('Deleted.')
      setAdminChatFrames(p => p.filter(f => getChatFrameId(f) !== fid))
    }
    catch (err) { showMsg(err.message || 'Delete failed.', false) }
  }

  const handleCreateAdminGift = async () => {
    if (!newGift.name.trim()) { showMsg('Gift name required.', false); return }
    try {
      await createAdminGift({
        name: newGift.name.trim(),
        priceNgn: Number(newGift.priceNgn) || 500,
        effectKey: newGift.effectKey,
        tier: newGift.tier,
        color: GIFT_EFFECT_OPTIONS.find(o => o.value === newGift.effectKey)?.color,
      })
      showMsg('Gift created!')
      setNewGift({ name: '', priceNgn: 500, effectKey: 'tiny', tier: 'common' })
      loadTabData('Gifts')
    } catch (err) { showMsg(err.message || 'Failed.', false) }
  }

  const handleDeleteAdminGift = async (gift) => {
    const gid = gift.giftId || gift._id || gift.id || gift.name
    if (!await appConfirm('Delete Gift', `Delete "${gift.name || gid}"?`, { variant: 'danger', confirmLabel: 'Delete' })) return
    try { await deleteAdminGift(gid); showMsg('Deleted.'); setAdminGifts(p => p.filter(g => (g.giftId || g._id || g.id || g.name) !== gid)) }
    catch (err) { showMsg(err.message || 'Delete failed.', false) }
  }

  const handleLoadDeliveryLogs = async () => {
    if (!deliveryBroadcastId.trim()) { showMsg('Enter a broadcast ID.', false); return }
    try {
      const res = await getBroadcastDeliveryLogs({ broadcastId: deliveryBroadcastId.trim() })
      const list = res?.data?.logs || res?.logs || res?.data || []
      setDeliveryLogs(Array.isArray(list) ? list : [])
      if (Array.isArray(list) && list.length === 0) showMsg('No delivery logs found.', false)
    } catch (err) { showMsg(err.message || 'Failed.', false) }
  }

  const handleApproveBroadcast = async (broadcastId) => {
    if (!await appConfirm('Approve Broadcast', 'Send this broadcast to all users?', { confirmLabel: 'Approve' })) return
    try {
      await approveBroadcastRequest(broadcastId)
      showMsg('Broadcast approved!')
      setPendingBroadcastRequests(prev => prev.filter(r => r.requestId !== broadcastId))
    }
    catch (err) { showMsg(err.message || 'Failed.', false) }
  }

  const handleRejectBroadcast = async (broadcastId) => {
    if (!await appConfirm('Reject Broadcast', 'Reject this broadcast request?', { variant: 'danger', confirmLabel: 'Reject' })) return
    try {
      await rejectBroadcastRequest(broadcastId)
      showMsg('Broadcast request rejected.')
      setPendingBroadcastRequests(prev => prev.filter(r => r.requestId !== broadcastId))
    }
    catch (err) { showMsg(err.message || 'Failed.', false) }
  }

  const handleApproveChatFrameRequest = async (requestId) => {
    if (!await appConfirm('Approve Chat Frame', 'Approve this chat frame request and add it to the store?', { confirmLabel: 'Approve' })) return
    try {
      const res = await approveChatFrameRequest(requestId)
      const frame = res?.data?.frame || res?.frame
      if (frame) rememberChatFrame(frame)
      showMsg('Chat frame request approved!')
      setPendingChatFrameRequests(prev => prev.filter(r => r.requestId !== requestId))
      loadTabData('Gifts')
    }
    catch (err) { showMsg(err.message || 'Failed.', false) }
  }

  const handleRejectChatFrameRequest = async (requestId) => {
    if (!await appConfirm('Reject Chat Frame', 'Reject this chat frame request?', { variant: 'danger', confirmLabel: 'Reject' })) return
    try {
      await rejectChatFrameRequest(requestId)
      showMsg('Chat frame request rejected.')
      setPendingChatFrameRequests(prev => prev.filter(r => r.requestId !== requestId))
    }
    catch (err) { showMsg(err.message || 'Failed.', false) }
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
      const [videosRes, musicRes, profileBgRes] = await Promise.allSettled([getMediaVideos(), getMediaMusic(), getProfileBackgrounds()])
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
      if (profileBgRes.status === 'fulfilled') {
        const list = pickList(profileBgRes.value, 'backgrounds', 'profileBackgrounds', 'items', 'media')
        if (list !== null) setProfileBackgrounds(list)
      } else {
        console.warn('[Admin] getProfileBackgrounds failed', profileBgRes.reason)
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
    if (!await appConfirm('Delete Video', 'Delete this video? This cannot be undone.', { variant: 'danger', confirmLabel: 'Delete' })) return
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

  const handleProfileBgFile = async (file) => {
    if (!file) { showMsg('No file selected.', false); return }
    if (!file.type.startsWith('image/')) {
      showMsg(`Please select an image file. Got "${file.type || 'unknown'}".`, false)
      return
    }
    setProfileBgUploading(true)
    try {
      const url = await uploadToCloudinary(file, 'image')
      const fallbackName = file.name.replace(/\.[^.]+$/, '').slice(0, 80)
      const finalName = (newProfileBg.name || '').trim() || fallbackName
      const id = `bg_${Date.now()}_${finalName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'profile'}`
      try {
        await createProfileBackground({ id, name: finalName, url, imageUrl: url })
        showMsg('Profile background added!')
        setNewProfileBg({ name: '', url: '' })
        if (profileBgInputRef.current) profileBgInputRef.current.value = ''
        await refreshMediaSilent()
      } catch (postErr) {
        console.error('[Admin] createProfileBackground POST failed', postErr)
        setNewProfileBg({ name: finalName, url })
        showMsg(`Save failed (image uploaded): ${postErr.message || 'unknown error'}`, false)
      }
    } catch (err) {
      console.error('[Admin] Cloudinary profile background upload failed', err)
      showMsg(`Upload failed: ${err.message || 'unknown error'}`, false)
    } finally {
      setProfileBgUploading(false)
    }
  }

  const handleAddProfileBg = async () => {
    if (!newProfileBg.name || !newProfileBg.url) { showMsg('Name and image required.', false); return }
    try {
      const id = `bg_${Date.now()}_${newProfileBg.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'profile'}`
      await createProfileBackground({ id, name: newProfileBg.name, url: newProfileBg.url, imageUrl: newProfileBg.url })
      showMsg('Profile background added!')
      setNewProfileBg({ name: '', url: '' })
      if (profileBgInputRef.current) profileBgInputRef.current.value = ''
      refreshMediaSilent()
    } catch (err) {
      console.error('[Admin] createProfileBackground failed', err)
      showMsg(`Save failed: ${err.message || 'unknown error'}`, false)
    }
  }

  const handleDeleteProfileBg = async (bg) => {
    const bgId = bg.id || bg._id
    if (!bgId) return
    if (!await appConfirm('Delete Profile Background', 'Delete this premium background? This cannot be undone.', { variant: 'danger', confirmLabel: 'Delete' })) return
    try {
      await deleteProfileBackground(bgId)
      setProfileBackgrounds(prev => prev.filter(item => (item.id || item._id) !== bgId))
      showMsg('Profile background deleted.')
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
      // Hold the file locally so the admin can trim it BEFORE we burn a
      // Cloudinary slot. Only the trimmed segment will be uploaded on save —
      // the original raw file is discarded if they discard the draft.
      const localUrl = URL.createObjectURL(file)
      const duration = await getAudioDuration(file).catch(() => 0)
      const defaultName = (newTrack.name || '').trim() ||
        file.name.replace(/\.[^.]+$/, '').slice(0, 80)
      setMusicDraft({
        url: localUrl,
        name: defaultName,
        file,                  // raw file kept in state for the eventual trim+upload
        duration,
        startSec: 0,
        endSec: duration,
      })
      setNewTrack({ name: '', url: '' })
      if (mediaMusicInputRef.current) mediaMusicInputRef.current.value = ''
      showMsg('Set the play span, then save — only the trimmed clip is uploaded.')
    } catch (err) {
      console.error('[Admin] audio file load failed', err)
      showMsg(`Could not read audio: ${err.message || 'unknown error'}`, false)
    } finally {
      setMediaMusicUploading(false)
    }
  }

  // Single-shot save for a freshly-uploaded clip. The trim is applied
  // client-side BEFORE the upload — only the chosen play span ends up in
  // Cloudinary and the library. The full file never leaves the browser.
  const handleSaveDraftTrack = async (draft) => {
    try {
      const startSec = Number(draft.startSec || 0)
      const endSec = Number(draft.endSec || 0)
      const fullDuration = Number(draft.duration || 0)
      const trimmed = endSec > 0 && (startSec > 0 || endSec < fullDuration - 0.05)
      const sourceFile = draft.file
      if (!sourceFile) {
        showMsg('Original audio file is missing — please re-upload.', false)
        return
      }
      const fileToUpload = trimmed
        ? await trimAudioFile(sourceFile, startSec, endSec)
        : sourceFile
      const url = await uploadToCloudinary(fileToUpload, 'video')
      const finalDuration = trimmed ? Math.max(1, Math.round(endSec - startSec)) : Math.max(1, Math.round(fullDuration))
      await uploadMediaMusic({
        name: draft.name,
        url,
        duration: finalDuration,
      })
      // Release the local blob URL — we no longer need it.
      if (draft.url?.startsWith('blob:')) URL.revokeObjectURL(draft.url)
      showMsg(trimmed ? 'Trimmed clip added to library!' : 'Track added to library!')
      setMusicDraft(null)
      await refreshMediaSilent()
    } catch (err) {
      console.error('[Admin] trim+upload music failed', err)
      showMsg(`Save failed: ${err.message || 'unknown error'}`, false)
      throw err
    }
  }

  const handleDiscardDraft = async () => {
    if (!await appConfirm('Discard Upload', 'Discard this upload? The audio is held only in your browser and will not be saved.', { variant: 'warning', confirmLabel: 'Discard' })) return
    if (musicDraft?.url?.startsWith('blob:')) URL.revokeObjectURL(musicDraft.url)
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

  const getTemplateAdminId = (tplOrId) => {
    if (!tplOrId) return ''
    if (typeof tplOrId === 'string') return tplOrId
    return (
      tplOrId.backendTemplate?._id ||
      tplOrId.backendTemplate?.templateId ||
      tplOrId.templateId ||
      tplOrId._id ||
      tplOrId.id ||
      ''
    )
  }

  const markTemplateDisabled = (id, disabledUntil) => {
    setAllTemplates(prev => prev.map(t => (
      String(getTemplateAdminId(t)) === String(id)
        ? {
            ...t,
            status: 'disabled',
            tag: 'Disabled',
            disabledUntil,
            backendTemplate: { ...(t.backendTemplate || {}), status: 'disabled', disabledUntil },
          }
        : t
    )))
  }

  const markTemplateEnabled = (id) => {
    setAllTemplates(prev => prev.map(t => (
      String(getTemplateAdminId(t)) === String(id)
        ? {
            ...t,
            status: 'approved',
            tag: 'Approved',
            disabledUntil: null,
            backendTemplate: { ...(t.backendTemplate || {}), status: 'approved', disabledUntil: null },
          }
        : t
    )))
  }

  const removeTemplateFromAdminLists = (id) => {
    setAllTemplates(prev => prev.filter(t => String(getTemplateAdminId(t)) !== String(id)))
  }

  const handleAdminDisableTemplate = async (tplOrId) => {
    const id = getTemplateAdminId(tplOrId)
    const title = typeof tplOrId === 'object' ? (tplOrId.title || tplOrId.name || 'this template') : 'this template'
    if (!id) return
    if (!await appConfirm(
      'Disable Template',
      `Disable "${title}" for ${TEMPLATE_DISABLE_DAYS} day(s)? You can re-enable it manually sooner.`,
      { variant: 'warning', confirmLabel: 'Disable' },
    )) return
    const disabledUntil = new Date(Date.now() + TEMPLATE_DISABLE_DAYS * 24 * 60 * 60 * 1000).toISOString()
    try {
      await disableAdminTemplate(id, {
        durationDays: TEMPLATE_DISABLE_DAYS,
        disabledUntil,
        reason: 'Admin moderation action',
      })
      showMsg(`Template disabled for ${TEMPLATE_DISABLE_DAYS} day(s).`)
      markTemplateDisabled(id, disabledUntil)
    } catch (err) {
      showMsg(err.message || 'Disable failed.', false)
    }
  }

  const handleAdminEnableTemplate = async (tplOrId) => {
    const id = getTemplateAdminId(tplOrId)
    const title = typeof tplOrId === 'object' ? (tplOrId.title || tplOrId.name || 'this template') : 'this template'
    if (!id) return
    if (!await appConfirm('Enable Template', `Re-enable "${title}"?`, { confirmLabel: 'Enable' })) return
    try {
      await enableAdminTemplate(id)
      showMsg('Template re-enabled.')
      markTemplateEnabled(id)
    } catch (err) {
      showMsg(err.message || 'Enable failed.', false)
    }
  }

  const handleAdminDeleteTemplate = async (tplOrId) => {
    const id = getTemplateAdminId(tplOrId)
    const title = typeof tplOrId === 'object' ? (tplOrId.title || tplOrId.name || 'this template') : 'this template'
    if (!id) return
    if (!await appConfirm('Delete Template', `Delete "${title}"? This cannot be undone.`, { variant: 'danger', confirmLabel: 'Delete' })) return
    try {
      await adminDeleteTemplate(id)
      showMsg('Template deleted.')
      removeTemplateFromAdminLists(id)
    } catch (err) {
      const fallback = await deleteMarketplaceTemplate?.(id)
      if (fallback?.ok) {
        showMsg('Template deleted.')
        removeTemplateFromAdminLists(id)
        return
      }
      showMsg(fallback?.message || err.message || 'Delete failed.', false)
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
    if (!await appConfirm('Delete Track', 'Delete this track? This cannot be undone.', { variant: 'danger', confirmLabel: 'Delete' })) return
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
              <p className="admin-section-note">This will email every registered user. Both subject and message are required.</p>
              <div className="admin-broadcast-form">
                <input
                  className="admin-broadcast-subject"
                  placeholder="Email subject line…"
                  value={broadcastSubject}
                  onChange={e => setBroadcastSubject(e.target.value)}
                  maxLength={150}
                />
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
                  <button className="primary" type="button" onClick={handleBroadcast} disabled={!broadcastMessage.trim() || !broadcastSubject.trim()}>
                    Send to All
                  </button>
                </div>
              </div>
            </div>

            {/* Pending Broadcast Requests (submitted by moderators) */}
            <div className="admin-sub-section">
              <h4>Pending Broadcast Requests ({pendingBroadcastRequests.length})</h4>
              {pendingBroadcastRequests.length === 0 ? (
                <p style={{ color: 'rgba(220,240,247,0.4)' }}>No pending requests.</p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr><th>Subject</th><th>Message</th><th>Requested by</th><th>Date</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {pendingBroadcastRequests.map((req) => (
                        <tr key={req.requestId}>
                          <td>{req.subject}</td>
                          <td className="admin-cell-details">{req.message}</td>
                          <td>{req.requestedByUsername || req.requestedById || '—'}</td>
                          <td>{req.createdAt ? new Date(req.createdAt).toLocaleDateString() : '—'}</td>
                          <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button type="button" className="admin-action-btn approve" onClick={() => handleApproveBroadcast(req.requestId)}>Approve</button>
                            <button type="button" className="admin-action-btn reject" onClick={() => handleRejectBroadcast(req.requestId)}>Reject</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* GIFTS & CHAT FRAMES */}
        {activeTab === 'Gifts' && !loading && (
          <div className="admin-section">
            <h3 className="admin-section-title">Gift & Chat Frame Management</h3>

            {/* Signup Bonus Controls */}
            <div className="admin-sub-section">
              <h4>Signup Bonus</h4>
              {signupBonus ? (
                <div className="admin-stats-grid">
                  <div className="admin-stat-card"><div className="admin-stat-value">{signupBonus.limit ?? signupBonus.maxUses ?? '—'}</div><div className="admin-stat-label">Limit</div></div>
                  <div className="admin-stat-card"><div className="admin-stat-value">{signupBonus.used ?? signupBonus.claimedCount ?? '—'}</div><div className="admin-stat-label">Used</div></div>
                  <div className="admin-stat-card"><div className="admin-stat-value">{signupBonus.remaining ?? '—'}</div><div className="admin-stat-label">Remaining</div></div>
                  <div className="admin-stat-card"><div className="admin-stat-value">{signupBonus.amount ?? signupBonus.bonusCC ?? '—'}</div><div className="admin-stat-label">CC Amount</div></div>
                </div>
              ) : <p style={{ color: 'rgba(220,240,247,0.4)' }}>Loading…</p>}
              <button className="primary" type="button" onClick={handleResetSignupBonus} style={{ marginTop: 12 }}>Reset Signup Bonus Counter</button>
            </div>

            {/* Create Gift */}
            <div className="admin-sub-section">
              <h4>Create Gift</h4>
              <div className="admin-inline-form">
                <label className="admin-field"><span>Gift Name</span><input placeholder="e.g. spark" value={newGift.name} onChange={e => setNewGift(p => ({ ...p, name: e.target.value }))} /></label>
                <label className="admin-field"><span>Price (NGN)</span><input type="number" placeholder="500" value={newGift.priceNgn} onChange={e => setNewGift(p => ({ ...p, priceNgn: Number(e.target.value) }))} /></label>
                <label className="admin-field">
                  <span>Type (heart color)</span>
                  <Dropdown
                    value={newGift.effectKey}
                    onChange={v => setNewGift(p => ({ ...p, effectKey: v }))}
                    options={GIFT_EFFECT_OPTIONS}
                  />
                </label>
                <label className="admin-field">
                  <span>Tier</span>
                  <Dropdown
                    value={newGift.tier}
                    onChange={v => setNewGift(p => ({ ...p, tier: v }))}
                    options={GIFT_TIER_OPTIONS.map(t => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))}
                  />
                </label>
                <button className="primary" type="button" onClick={handleCreateAdminGift}>Create Gift</button>
              </div>
            </div>

            {/* Gift List */}
            {adminGifts.length > 0 && (
              <div className="admin-sub-section">
                <h4>Existing Gifts ({adminGifts.length})</h4>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>Name</th><th>Price (NGN)</th><th>Type</th><th>Tier</th><th>Actions</th></tr></thead>
                    <tbody>
                      {adminGifts.map((g, i) => (
                        <tr key={g.giftId || g._id || g.name || i}>
                          <td>{g.name}</td>
                          <td>{g.priceNgn ?? '—'}</td>
                          <td>{g.color || GIFT_EFFECT_OPTIONS.find(o => o.value === g.effectKey)?.color || '—'}</td>
                          <td>{g.tier || '—'}</td>
                          <td><button type="button" className="admin-action-btn danger" onClick={() => handleDeleteAdminGift(g)}>Delete</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Create Chat Frame */}
            <div className="admin-sub-section">
              <h4>Create Chat Frame</h4>
              <div className="admin-inline-form">
                <label className="admin-field"><span>Frame ID</span><input placeholder="frame_neon (auto if empty)" value={newChatFrame.id} onChange={e => setNewChatFrame(p => ({ ...p, id: e.target.value }))} /></label>
                <label className="admin-field"><span>Name</span><input placeholder="Neon Glow" value={newChatFrame.name} onChange={e => setNewChatFrame(p => ({ ...p, name: e.target.value }))} /></label>
                <input
                  ref={chatFrameInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => handleChatFrameFile(e.target.files?.[0])}
                />
                <button
                  type="button"
                  className={`admin-media-file-btn${newChatFrame.url ? ' ready' : ''}${chatFrameUploading ? ' uploading' : ''}`}
                  onClick={() => !chatFrameUploading && chatFrameInputRef.current?.click()}
                  disabled={chatFrameUploading}
                >
                  {chatFrameUploading ? (
                    <><span className="admin-media-file-spinner" />Uploading...</>
                  ) : newChatFrame.url ? (
                    <><span>Ready</span> Replace image</>
                  ) : (
                    <><span className="admin-media-file-icon">Upload</span> Upload image</>
                  )}
                </button>
                <label className="admin-field"><span>Price (CC)</span><input type="number" placeholder="5" value={newChatFrame.price} onChange={e => setNewChatFrame(p => ({ ...p, price: Number(e.target.value) }))} /></label>
                <button className="primary" type="button" onClick={handleCreateChatFrame} disabled={chatFrameUploading || !newChatFrame.url}>Create Frame</button>
              </div>
              {newChatFrame.url && (
                <>
                  <p className="admin-media-hint">This is exactly how the frame will wrap a World Chat bubble — the border art should sit in the outer ~25% of the image with a transparent center, since it's stretched around the bubble's edges (not shown as a circular avatar ring).</p>
                  <div className="cf-bubble-wrap" style={{ marginTop: 8 }}>
                    <div className="cf-frame-overlay" style={{ borderImageSource: `url(${newChatFrame.url})`, borderImageSlice: '33% fill', borderImageWidth: '24px' }} />
                    <div className="cf-bubble-text">Hey! This frame looks great 🔥</div>
                  </div>
                </>
              )}
            </div>

            {/* Pending Chat Frame Requests (submitted by moderators) */}
            <div className="admin-sub-section">
              <h4>Pending Chat Frame Requests ({pendingChatFrameRequests.length})</h4>
              {pendingChatFrameRequests.length === 0 ? (
                <p style={{ color: 'rgba(220,240,247,0.4)' }}>No pending requests.</p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr><th>Preview</th><th>Name</th><th>Price</th><th>Requested by</th><th>Date</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {pendingChatFrameRequests.map((req) => (
                        <tr key={req.requestId}>
                          <td>
                            {req.url
                              ? <img src={req.url} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                              : '—'}
                          </td>
                          <td>{req.name}</td>
                          <td>{req.price ?? '—'}</td>
                          <td>{req.requestedByUsername || req.requestedById || '—'}</td>
                          <td>{req.createdAt ? new Date(req.createdAt).toLocaleDateString() : '—'}</td>
                          <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button type="button" className="admin-action-btn approve" onClick={() => handleApproveChatFrameRequest(req.requestId)}>Approve</button>
                            <button type="button" className="admin-action-btn reject" onClick={() => handleRejectChatFrameRequest(req.requestId)}>Reject</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Chat Frame List */}
            <div className="admin-sub-section">
              <h4>Existing Chat Frames ({adminChatFrames.length})</h4>
              {adminChatFrames.length === 0 ? (
                <p style={{ color: 'rgba(220,240,247,0.4)', fontSize: '0.85rem' }}>No frames uploaded yet.</p>
              ) : (
                <div className="admin-frame-grid">
                  {adminChatFrames.map((f, i) => {
                    const imgUrl = getChatFrameUrl(f)
                    const frameId = getChatFrameId(f)
                    return (
                      <div key={frameId || i} className="admin-frame-tile">
                        <div className="admin-frame-tile-preview">
                          {imgUrl
                            ? <img src={imgUrl} alt={f.name || 'Frame'} />
                            : <span className="admin-frame-tile-no-img">No image</span>
                          }
                        </div>
                        <div className="admin-frame-tile-info">
                          <span className="admin-frame-tile-name">{f.name || '—'}</span>
                          <span className="admin-frame-tile-price">{f.price ?? '—'} CC</span>
                          <span className="admin-frame-tile-id">{frameId || '—'}</span>
                        </div>
                        <button
                          type="button"
                          className="admin-action-btn danger admin-frame-tile-delete"
                          onClick={() => handleDeleteChatFrame(f)}
                        >
                          Delete
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Broadcast Delivery Logs */}
            <div className="admin-sub-section">
              <h4>Broadcast Delivery Logs</h4>
              <div className="admin-inline-form">
                <label className="admin-field"><span>Broadcast ID</span><input placeholder="broadcast id" value={deliveryBroadcastId} onChange={e => setDeliveryBroadcastId(e.target.value)} /></label>
                <button className="primary" type="button" onClick={handleLoadDeliveryLogs}>Look Up</button>
              </div>
              {deliveryLogs.length > 0 && (
                <div className="admin-table-wrap" style={{ marginTop: 12 }}>
                  <table className="admin-table">
                    <thead><tr><th>Recipient</th><th>Status</th><th>Date</th></tr></thead>
                    <tbody>
                      {deliveryLogs.map((log, i) => (
                        <tr key={log._id || i}>
                          <td>{log.recipientEmail || log.recipientId || '—'}</td>
                          <td><span className={`admin-status-chip ${log.status || 'pending'}`}>{log.status || 'pending'}</span></td>
                          <td>{log.createdAt ? new Date(log.createdAt).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
              <p className="admin-sub-hint">Change any user's role by entering their ID or username below.</p>
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
                  <span>New Role</span>
                  <Dropdown
                    value={roleForm.role}
                    onChange={v => setRoleForm(p => ({ ...p, role: v }))}
                    options={[
                      { value: 'moderator', label: 'Moderator' },
                      { value: 'enterprise', label: 'Enterprise' },
                      { value: 'artist', label: 'Artist' },
                      { value: 'user', label: 'User (reset)' },
                    ]}
                  />
                </label>
                <button className="primary" type="button" onClick={() => openRoleConfirm()}>Assign Role</button>
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
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedUsers.map(user => {
                    const uid = user._id || user.id
                    const uname = user.username || user.name || uid
                    const currentRole = (user.role || 'user').toLowerCase()
                    return (
                      <tr key={uid}>
                        <td>{uname}</td>
                        <td>{user.email}</td>
                        <td><span className={`admin-role-chip ${currentRole}`}>{user.role || 'User'}</span></td>
                        <td>{user.cc ?? user.balance ?? 0}</td>
                        <td>{user.isVerified ? 'Yes' : 'No'}</td>
                        <td className="admin-actions-cell">
                          <button
                            type="button"
                            className="admin-action-btn reject"
                            onClick={() => {
                              const identifier = uid || uname
                              setBanForm(p => ({ ...p, identifier }))
                              setBanConfirm({
                                user,
                                identifier,
                                payload: { identifier, userId: identifier, durationDays: banForm.durationDays, reason: banForm.reason },
                              })
                            }}
                          >
                            Ban
                          </button>
                          <button
                            type="button"
                            className="admin-action-btn approve"
                            onClick={async () => {
                              try { const identifier = uid || uname; await unbanUser({ identifier, userId: identifier }); showMsg(`"${uname}" unbanned.`); loadTabData('Users') }
                              catch (err) { showMsg(err.message || 'Failed', false) }
                            }}
                          >
                            Unban
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {users.length === 0 && <tr><td colSpan={6}>No users found.</td></tr>}
                </tbody>
              </table>
            </div>
            <TablePagination {...usersPaging} />
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
                  onChange={val => {
                    setReportFilter(p => ({ ...p, type: val }))
                    handleLoadReports({ type: val })
                  }}
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
                  onChange={val => {
                    setReportFilter(p => ({ ...p, status: val }))
                    handleLoadReports({ status: val })
                  }}
                  options={[
                    { value: 'open', label: 'Open' },
                    { value: 'reviewed', label: 'Reviewed' },
                    { value: 'resolved', label: 'Resolved' },
                    { value: 'dismissed', label: 'Dismissed' },
                  ]}
                />
              </label>
              <button className="primary" type="button" onClick={() => handleLoadReports()}>Refresh</button>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Target Info</th>
                    <th>Reason</th>
                    <th>Details</th>
                    <th>Reported by</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedReports.map((rep, i) => {
                    const targetId = rep.targetId || rep.templateId;
                    const isTemplate = rep.type === 'template';
                    const isUser = rep.type === 'user';
                    
                    let targetContext = '';
                    let artistName = '';
                    let matchedTemplate = null;
                    
                    if (isTemplate) {
                      const tpl = allTemplates.find(t => (
                        [t.id, t.templateId, t.backendTemplate?._id, t.backendTemplate?.id, t.backendTemplate?.templateId]
                          .some(id => id && targetId && String(id) === String(targetId))
                      ));
                      if (tpl) {
                        matchedTemplate = tpl;
                        targetContext = tpl.title || 'Unknown Template';
                        artistName = tpl.ownerId || tpl.artist || tpl.createdBy || 'Unknown Artist';
                        const user = users.find(u => (u.id || u._id) === artistName);
                        if (user) artistName = user.username || user.name || artistName;
                      }
                    } else if (isUser) {
                      const user = users.find(u => (u.id || u._id || u.username) === targetId);
                      if (user) {
                        targetContext = user.username || user.name;
                      }
                    }
                    
                    const reportCount = reports.filter(r => (r.targetId || r.templateId) === targetId).length;

                    return (
                      <tr key={rep.reportId || rep._id || i}>
                        <td>
                          <span className={`admin-role-chip ${rep.type || 'user'}`}>{rep.type || '—'}</span>
                          {reportCount > 1 && <span style={{fontSize: '0.7rem', color: '#ffb74d', display: 'block', marginTop: 4}}>{reportCount} reports</span>}
                        </td>
                        <td className="admin-cell-mono" style={{ maxWidth: 200, wordWrap: 'break-word' }}>
                          <div>{targetId || '—'}</div>
                          {targetContext && <div style={{fontSize: '0.75rem', opacity: 0.7, marginTop: 4}}>Name: {targetContext}</div>}
                          {artistName && <div style={{fontSize: '0.75rem', opacity: 0.7}}>Artist: {artistName}</div>}
                        </td>
                        <td>{rep.reason || '—'}</td>
                        <td className="admin-cell-details">{rep.details || '—'}</td>
                        <td>{rep.reportedByUsername || rep.reportedById || '—'}</td>
                        <td><span className={`admin-status-chip ${rep.status || 'open'}`}>{rep.status || 'open'}</span></td>
                        <td>{rep.createdAt ? new Date(rep.createdAt).toLocaleDateString() : '—'}</td>
                        <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {isTemplate && (
                            <>
                              <button 
                                type="button" 
                                className="admin-action-btn warn"
                                onClick={() => handleAdminDisableTemplate(matchedTemplate || targetId)}
                              >
                                Disable
                              </button>
                              <button 
                                type="button" 
                                className="admin-action-btn reject"
                                onClick={() => handleAdminDeleteTemplate(matchedTemplate || targetId)}
                              >
                                Delete
                              </button>
                            </>
                          )}
                          {isUser && (
                            <button 
                              type="button" 
                              className="admin-action-btn reject"
                              onClick={() => {
                                setBanForm(p => ({ ...p, identifier: targetId }))
                                openBanConfirm()
                              }}
                            >
                              Ban User
                            </button>
                          )}
                          {rep.status !== 'resolved' && (
                            <button
                              type="button"
                              className="admin-action-btn approve"
                              onClick={() => handleUpdateReportStatus(rep, 'resolved')}
                            >
                              Resolve
                            </button>
                          )}
                          {rep.status !== 'dismissed' && (
                            <button
                              type="button"
                              className="admin-action-btn warn"
                              onClick={() => handleUpdateReportStatus(rep, 'dismissed')}
                            >
                              Dismiss
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {reports.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: 'center', opacity: 0.5 }}>No reports found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <TablePagination {...reportsPaging} />
          </div>
        )}

        {/* TEMPLATES — live marketplace only (backend doesn't gate by approval) */}
        {activeTab === 'Templates' && !loading && (() => {
          const live = allTemplates

          const renderTable = (rows) => (
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
                  {rows.map((tpl) => {
                    const templateStatus = String(tpl.status || tpl.backendTemplate?.status || 'approved').toLowerCase()
                    const isDisabled = ['disabled', 'inactive', 'suspended'].includes(templateStatus) || Boolean(tpl.disabledUntil || tpl.backendTemplate?.disabledUntil)
                    const disabledUntil = tpl.disabledUntil || tpl.backendTemplate?.disabledUntil
                    return (
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
                          {isDisabled ? 'Disabled' : (tpl.tag || 'Live')}
                        </span>
                        {isDisabled && disabledUntil && (
                          <div style={{ fontSize: '0.72rem', opacity: 0.6, marginTop: 4 }}>
                            until {new Date(disabledUntil).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(tpl.status === 'pending' || tpl.status === 'review') && (
                          <>
                            <button
                              type="button"
                              className="admin-action-btn approve"
                              onClick={async () => {
                                const id = tpl.templateId || tpl.id
                                if (!id) return
                                try { await approveTemplate(id); showMsg('Template approved.'); loadTabData('Templates') }
                                catch (err) { showMsg(err.message || 'Approve failed', false) }
                              }}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="admin-action-btn reject"
                              onClick={async () => {
                                const id = tpl.templateId || tpl.id
                                if (!id) return
                                try { await rejectTemplate(id, 'Does not meet guidelines'); showMsg('Template rejected.'); loadTabData('Templates') }
                                catch (err) { showMsg(err.message || 'Reject failed', false) }
                              }}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {isDisabled ? (
                          <button
                            type="button"
                            className="admin-action-btn approve"
                            onClick={() => handleAdminEnableTemplate(tpl)}
                          >
                            Enable
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="admin-action-btn warn"
                            onClick={() => handleAdminDisableTemplate(tpl)}
                          >
                            Disable
                          </button>
                        )}
                        <button
                          type="button"
                          className="admin-action-btn reject"
                          onClick={() => handleAdminDeleteTemplate(tpl)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )

          return (
            <div className="admin-section">
              <h3 className="admin-section-title">
                Live Templates {live.length > 0 ? `(${live.length})` : ''}
              </h3>
              {live.length > 0 ? (
                <>
                  {renderTable(pagedAllTemplates)}
                  <TablePagination {...allTemplatesPaging} />
                </>
              ) : (
                <div className="admin-empty">
                  <span className="admin-empty-icon">{"\u{1F4C4}"}</span>
                  <p>No templates in the marketplace yet.</p>
                </div>
              )}
            </div>
          )
        })()}

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
                  <tr><th>Code</th><th>CC</th><th>Uses</th><th>Active</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {redeemCodes.map(code => (
                    <tr key={code._id || code.code}>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <code>{code.code}</code>
                          <button
                            type="button"
                            className="admin-action-btn"
                            style={{ padding: '2px 7px', fontSize: '0.65rem' }}
                            onClick={() => navigator.clipboard?.writeText(code.code).then(() => showMsg('Copied!'))}
                            title="Copy code"
                          >
                            Copy
                          </button>
                        </span>
                      </td>
                      <td>{code.ccAmount ?? code.numberOfCC}</td>
                      <td>{code.uses ?? code.usedCount ?? 0}/{code.maxUses ?? '∞'}</td>
                      <td>{code.isActive !== false ? 'Active' : 'Inactive'}</td>
                      <td style={{ display: 'flex', gap: 4 }}>
                        {code.isActive !== false ? (
                          <button type="button" className="admin-action-btn warn" onClick={() => handleDisableCode(code)}>
                            Disable
                          </button>
                        ) : (
                          <button type="button" className="admin-action-btn approve" onClick={() => handleEnableCode(code)}>
                            Enable
                          </button>
                        )}
                        <button type="button" className="admin-action-btn reject" onClick={() => handleDeleteCode(code)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {redeemCodes.length === 0 && <tr><td colSpan={5}>No codes.</td></tr>}
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
                <label className="admin-field">
                  <span>Enterprise Account <small>(optional)</small></span>
                  <Dropdown
                    value={newAd.enterpriseName}
                    onChange={username => {
                      setNewAd(p => ({
                        ...p,
                        enterpriseId: username,
                        enterpriseName: username,
                      }))
                    }}
                    options={[
                      { value: '', label: 'No enterprise owner' },
                      ...enterpriseUsers.map(user => {
                        const username = user.username || user.name || user.email
                        return { value: username, label: username }
                      }),
                    ]}
                  />
                </label>

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
                  <span>CTA Link URL <small>(optional — shown as a button after the ad)</small></span>
                  <input type="url" placeholder="https://example.com" value={newAd.linkUrl} onChange={e => setNewAd(p => ({ ...p, linkUrl: e.target.value }))} />
                </label>
                <label className="admin-field">
                  <span>Max Views <small>(optional — ad auto-disables when reached)</small></span>
                  <input type="number" placeholder="unlimited" value={newAd.maxViews} onChange={e => setNewAd(p => ({ ...p, maxViews: e.target.value }))} />
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
                  <span className="admin-stat-icon">{"\u{1F5B1}"}</span>
                  <div className="admin-stat-value">{adsAnalytics.totalClicks ?? adsAnalytics.clicks ?? 0}</div>
                  <div className="admin-stat-label">Total Clicks</div>
                </div>
                <div className="admin-stat-card">
                  <span className="admin-stat-icon">{"\u{2705}"}</span>
                  <div className="admin-stat-value">{adsAnalytics.totalCompletions ?? adsAnalytics.completions ?? 0}</div>
                  <div className="admin-stat-label">Completions</div>
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
                  <tr><th>Name</th><th>Enterprise</th><th>Type</th><th>Reward</th><th>Duration</th><th>Views</th><th>Clicks</th><th>CTA</th><th>Active</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {pagedAds.map(ad => {
                    const adId = ad._id || ad.id
                    return (
                    <tr key={adId}>
                      <td>{ad.name || '—'}</td>
                      <td>
                        {(() => {
                          const displayValue = ad.enterpriseAccountUsername || ad.enterpriseAccountName || ad.enterpriseName || ad.owner?.username || ad.enterprise?.username || ''
                          const knownUsernames = enterpriseUsers.map(user => user.username || user.name || user.email)
                          return (
                            <Dropdown
                              value={displayValue}
                              onChange={async selectedUsername => {
                                const adId = ad._id || ad.id
                                if (!adId) return
                                try {
                                  await updateAdminAd(adId, { enterpriseAccountUsername: selectedUsername || null })
                                  showMsg('Enterprise account assigned.')
                                  loadTabData('Ads')
                                } catch (err) {
                                  showMsg(err.message || 'Could not assign enterprise account.', false)
                                }
                              }}
                              options={[
                                { value: '', label: 'Unassigned' },
                                ...(displayValue && !knownUsernames.includes(displayValue) ? [{ value: displayValue, label: displayValue }] : []),
                                ...knownUsernames.map(username => ({ value: username, label: username })),
                              ]}
                            />
                          )
                        })()}
                      </td>
                      <td>{ad.type}</td>
                      <td>{ad.rewardCC} CC</td>
                      <td>{ad.duration}s</td>
                      <td>{ad.currentViews ?? 0}{ad.maxViews ? `/${ad.maxViews}` : ''}</td>
                      <td>{ad.clicks ?? ad.clickCount ?? ad.totalClicks ?? 0}</td>
                      <td>{ad.linkUrl ? <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#7ef7ff', fontSize: '0.75rem' }}>Link</a> : '—'}</td>
                      <td>{ad.isActive ? 'Yes' : 'No'}</td>
                      <td style={{ display: 'flex', gap: 4 }}>
                        <button type="button" className="admin-action-btn approve" onClick={() => handleToggleAd(ad)}>
                          {ad.isActive ? 'Disable' : 'Enable'}
                        </button>
                        <button type="button" className="admin-action-btn reject" onClick={() => handleDeleteAd(ad)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                    )
                  })}
                  {ads.length === 0 && <tr><td colSpan={10}>No ads.</td></tr>}
                </tbody>
              </table>
            </div>
            <TablePagination {...adsPaging} />
          </div>
        )}

        {/* MEDIA LIBRARY */}
        {activeTab === 'Media' && !loading && (
          <div className="admin-section">
            <h3 className="admin-section-title">Media Library</h3>
            <p className="admin-section-note">Upload videos and music that users can pick inside Card Studio backgrounds.</p>

            {/* Profile Backgrounds */}
            <div className="admin-media-block">
              <div className="admin-media-block-header">
                <span className="admin-media-block-icon">Image</span>
                <div>
                  <h4 className="admin-media-block-title">Premium Profile Backgrounds</h4>
                  <p className="admin-media-block-desc">Images premium users can apply to their profile and WorldChat profile modal.</p>
                </div>
              </div>

              <div className="admin-media-add-form">
                <input
                  ref={profileBgInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => handleProfileBgFile(e.target.files?.[0])}
                />
                <div className="admin-media-add-row">
                  <label className="admin-field admin-media-title-field">
                    <span>Background Name <small>(optional — defaults to filename)</small></span>
                    <input
                      placeholder="e.g. Neon Bloom"
                      value={newProfileBg.name}
                      onChange={e => setNewProfileBg(p => ({ ...p, name: e.target.value }))}
                    />
                  </label>
                  <button
                    type="button"
                    className={`admin-media-file-btn${newProfileBg.url ? ' ready' : ''}${profileBgUploading ? ' uploading' : ''}`}
                    onClick={() => !profileBgUploading && profileBgInputRef.current?.click()}
                    disabled={profileBgUploading}
                  >
                    {profileBgUploading ? (
                      <><span className="admin-media-file-spinner" />Uploading…</>
                    ) : newProfileBg.url ? (
                      <><span>✓</span> Replace image</>
                    ) : (
                      <><span className="admin-media-file-icon">↑</span> Upload &amp; save</>
                    )}
                  </button>
                  {newProfileBg.url && (
                    <button
                      className="primary admin-media-add-btn"
                      type="button"
                      onClick={handleAddProfileBg}
                      disabled={profileBgUploading || !newProfileBg.name.trim()}
                      title="Retry saving the previous upload"
                    >
                      Retry save
                    </button>
                  )}
                </div>
                <p className="admin-media-hint">Images save to the premium background library automatically once uploaded.</p>
              </div>

              {profileBackgrounds.length > 0 ? (
                <div className="admin-profile-bg-grid">
                  {profileBackgrounds.map(bg => (
                    <div key={bg._id || bg.id || bg.url} className="admin-profile-bg-card">
                      <img src={bg.url || bg.imageUrl || bg.assetUrl || bg.cloudinaryUrl} alt={bg.name || ''} className="admin-profile-bg-thumb" />
                      <div className="admin-media-video-footer">
                        <span className="admin-media-video-title">{bg.name || bg.title || 'Untitled'}</span>
                        <button
                          type="button"
                          className="admin-media-delete-btn"
                          onClick={() => handleDeleteProfileBg(bg)}
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
                  <span>🖼</span>
                  <p>No profile backgrounds yet. Add the first one above.</p>
                </div>
              )}
            </div>

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

              {/* Music library — read-only saved tracks (delete only) */}
              {mediaMusic.length > 0 ? (
                <div className="admin-media-music-list">
                  {mediaMusic.map(track => (
                    <AdminMusicTrack
                      key={track._id || track.id}
                      mode="library"
                      track={track}
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
                  {pagedCoupons.map((c, i) => (
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
            <TablePagination {...couponsPaging} />
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
                  {pagedLogs.map((log, i) => (
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
            <TablePagination {...logsPaging} />

            <h3 className="admin-section-title" style={{ marginTop: 32 }}>Moderator Action Logs</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Moderator</th><th>Action</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {pagedModLogs.map((log, i) => (
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
            <TablePagination {...modLogsPaging} />
          </div>
        )}
      </div>
      <ScreenNav />

      {roleConfirm && (
        <div className="ban-confirm-overlay" role="dialog" aria-modal="true">
          <div className="ban-confirm-backdrop" onClick={() => { if (!roleSubmitting) { setRoleConfirm(null); setRoleError('') } }} />
          <div className="ban-confirm-card">
            <h3 className="ban-confirm-title">Confirm role change</h3>
            {roleConfirm.user ? (
              <div className="ban-confirm-user">
                <div className="ban-confirm-avatar">
                  {roleConfirm.user.profilePictureUrl
                    ? <img src={roleConfirm.user.profilePictureUrl} alt={roleConfirm.user.username || ''} />
                    : <span>{(roleConfirm.user.username || '?').slice(0, 1).toUpperCase()}</span>}
                </div>
                <div className="ban-confirm-info">
                  <div className="ban-confirm-username">{roleConfirm.user.username || '—'}</div>
                  <div className="ban-confirm-email">{roleConfirm.user.email || '—'}</div>
                  <div className="ban-confirm-meta">
                    <span className={`admin-role-chip ${(roleConfirm.user.role || 'user').toLowerCase()}`}>{roleConfirm.user.role || 'User'}</span>
                    <span>→</span>
                    <span className={`admin-role-chip ${roleConfirm.role}`}>{roleConfirm.role.charAt(0).toUpperCase() + roleConfirm.role.slice(1)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="ban-confirm-user ban-confirm-user-missing">
                <p>User not found in loaded list. Role change will be attempted using:</p>
                <code>{roleConfirm.identifier}</code>
                <p style={{ marginTop: 6 }}>New role: <strong>{roleConfirm.role}</strong></p>
              </div>
            )}
            <p className="ban-confirm-warn">This will immediately update the user's permissions. Proceed?</p>
            {roleError && <p style={{ color: '#ff6b9d', fontSize: '0.82rem', margin: '8px 0 0' }}>{roleError}</p>}
            <div className="ban-confirm-actions">
              <button type="button" className="ban-confirm-cancel" onClick={() => { setRoleConfirm(null); setRoleError('') }} disabled={roleSubmitting}>
                Cancel
              </button>
              <button type="button" className="ban-confirm-submit" onClick={confirmSetRole} disabled={roleSubmitting}>
                {roleSubmitting ? 'Updating…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {ConfirmModal}
      {statusModal && (
        <StatusModal
          type={statusModal.type}
          title={statusModal.title}
          message={statusModal.message}
          onClose={() => setStatusModal(null)}
        />
      )}
    </div>
  )
}

export default AdminDashboard


