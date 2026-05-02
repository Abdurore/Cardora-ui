const DEFAULT_API_BASE = 'https://cardora-uss3.onrender.com'
const API_BASE = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE).replace(/\/+$/, '')
const TOKEN_KEY = 'cardora:authToken'

function buildUrl(path) {
  if (/^https?:\/\//i.test(path)) return path
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
}

function readJsonSafely(text) {
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    // Some servers return an HTML 404/500 page when a route doesn't exist or
    // crashes. Don't pipe the entire HTML body into a toast — surface a short
    // marker that makes the cause obvious without the wall of markup.
    const trimmed = text.trim()
    if (/^<(?:!doctype|html|head|body|div|h1|p|span|table)/i.test(trimmed)) {
      return { message: 'Server returned a non-JSON response (likely a 404 or crash page).', _isHtml: true }
    }
    return { message: text }
  }
}

function getErrorMessage(payload, fallback) {
  // Backend validation errors come as { message: "Validation error", details: ["..."] }
  if (Array.isArray(payload?.details) && payload.details.length > 0) {
    return payload.details.join('. ')
  }
  return (
    payload?.message ||
    payload?.error ||
    payload?.errors?.[0]?.message ||
    fallback
  )
}

function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body
  const clone = { ...body }
  if ('password' in clone) clone.password = '[REDACTED]'
  if ('otp' in clone) clone.otp = '[REDACTED]'
  return clone
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token) {
  if (!token) return
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export function extractToken(payload) {
  return (
    payload?.token ||
    payload?.accessToken ||
    payload?.jwt ||
    payload?.data?.token ||
    payload?.data?.accessToken ||
    payload?.user?.token ||
    payload?.result?.token ||
    null
  )
}

async function request(path, { method = 'GET', body, auth = false, headers = {}, timeout = 30000 } = {}) {
  const url = buildUrl(path)
  const token = getStoredToken()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  if (method !== 'GET') console.log('[API Request]', method, url, body)
  let response
  try {
    response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (fetchErr) {
    clearTimeout(timer)
    if (fetchErr.name === 'AbortError') {
      const err = new Error('The server is taking too long to respond. It may be waking up — please try again in a moment.')
      err.status = 0
      err.debug = { url, method, timeout: true }
      throw err
    }
    throw fetchErr
  }
  clearTimeout(timer)

  const text = await response.text()
  const payload = readJsonSafely(text)

  if (!response.ok) {
    let baseMessage = getErrorMessage(payload, 'Request failed.')
    // For HTML responses, suffix the URL/method/status so the toast still
    // identifies which call failed without dumping the page body.
    if (payload?._isHtml) {
      baseMessage = `${response.status} ${method} ${path} — backend returned an HTML page (route may not exist).`
    }
    const error = new Error(baseMessage)
    error.status = response.status
    error.payload = payload
    error.debug = {
      url,
      method,
      requestBody: sanitizeBody(body),
      responseBody: payload,
    }
    console.error('[API Error]', method, url, response.status, JSON.stringify(payload, null, 2))
    throw error
  }

  return payload
}

/* ═══════════════════════════════════════════════
   AUTH
   ═══════════════════════════════════════════════ */
export async function signup(payload) {
  return request('/signup', { method: 'POST', body: payload, timeout: 150000 })
}

export async function verifyEmail(payload) {
  return request('/verify-email', { method: 'POST', body: payload, timeout: 150000 })
}

export async function requestOtp(payload) {
  return request('/request-otp', { method: 'POST', body: payload, timeout: 150000 })
}

export async function login(payload) {
  return request('/login', { method: 'POST', body: payload, timeout: 150000 })
}

export async function logout() {
  return request('/logout', { method: 'POST', auth: true })
}

export async function forgotPassword(payload) {
  return request('/forgot-password', { method: 'POST', body: payload, timeout: 150000 })
}

export async function resetPassword(payload) {
  return request('/reset-password', { method: 'POST', body: payload, timeout: 150000 })
}

export async function getSignupBonusAvailability() {
  return request('/signup-bonus/availability')
}

/* ═══════════════════════════════════════════════
   USERS
   ═══════════════════════════════════════════════ */
export async function getCurrentUser() {
  return request('/current-user', { auth: true })
}

export async function updateProfile(payload) {
  return request('/update-profile', { method: 'PUT', auth: true, body: payload })
}

export async function deleteAccount() {
  return request('/delete-account', { method: 'DELETE', auth: true })
}

export async function getUserCards(query = 'page=1&limit=20') {
  return request(`/usercards?${query}`, { auth: true })
}

/* ═══════════════════════════════════════════════
   CARDS
   ═══════════════════════════════════════════════ */
export async function createCard(payload) {
  // payload may include: type, poll, trivia, chain, anonTemplate fields
  return request('/create-card', { method: 'POST', auth: true, body: payload })
}

export async function updateCard(payload) {
  return request('/update-card', { method: 'PUT', auth: true, body: payload })
}

export async function deleteCard(payload) {
  return request('/delete-card', { method: 'DELETE', auth: true, body: payload })
}

export async function getCardBySlug(slug, password) {
  const qs = password ? `?password=${encodeURIComponent(password)}` : ''
  return request(`/cards/${slug}${qs}`)
}

export async function submitCardResponse(slug, body) {
  return request(`/cards/${slug}/response`, { method: 'POST', auth: true, body })
}

export async function submitPollVote(slug, body) {
  return request(`/cards/${slug}/poll-vote`, { method: 'POST', auth: true, body })
}

export async function submitChainReply(slug, body) {
  return request(`/cards/${slug}/chain-reply`, { method: 'POST', auth: true, body })
}

export async function submitTriviaAnswer(slug, body) {
  return request(`/cards/${slug}/trivia-submit`, { method: 'POST', auth: true, body })
}

/* ═══════════════════════════════════════════════
   COUPONS & STORE
   ═══════════════════════════════════════════════ */
export async function getUserCoupons() {
  return request('/user/coupons', { auth: true })
}

export async function claimDailyFreeCoupon() {
  return request('/claim-daily-free-coupon', { method: 'POST', auth: true })
}

export async function redeemCode(payload) {
  return request('/redeem-code', { method: 'POST', auth: true, body: payload })
}

export async function getCouponPackages(query = 'activeOnly=true') {
  return request(`/coupon-packages?${query}`)
}

export async function createPaystackCheckout(payload) {
  return request('/create-paystack-checkout', { method: 'POST', auth: true, body: payload })
}

export async function createCouponCheckout(payload) {
  return request('/create-coupon-checkout', { method: 'POST', auth: true, body: payload })
}

/* ═══════════════════════════════════════════════
   REWARDED ADS
   ═══════════════════════════════════════════════ */
export async function getRewardedAd() {
  return request('/ads/rewarded', { auth: true })
}

export async function completeAd(payload) {
  return request('/ads/complete', { method: 'POST', auth: true, body: payload })
}

export async function getAdStats() {
  return request('/ads/stats', { auth: true })
}

/* ═══════════════════════════════════════════════
   WORLD CHAT
   ═══════════════════════════════════════════════ */
export async function getWorldChat(query = 'page=1&limit=50') {
  return request(`/chats?${query}`, { auth: true })
}

/* ═══════════════════════════════════════════════
   TEMPLATES
   ═══════════════════════════════════════════════ */
export async function getTemplates(query = 'page=1&limit=24') {
  return request(`/templates?${query}`)
}

export async function getPopularTemplates(query = 'days=7&page=1&limit=10') {
  return request(`/templates/popular?${query}`)
}

export async function getTemplateById(id) {
  return request(`/templates/${id}`)
}

export async function likeTemplate(templateId) {
  return request(`/templates/${templateId}/like`, { method: 'POST', auth: true })
}

export async function unlikeTemplate(templateId) {
  return request(`/templates/${templateId}/unlike`, { method: 'POST', auth: true })
}

export async function createTemplate(payload) {
  return request('/create-template', { method: 'POST', auth: true, body: payload })
}

export async function updateTemplate(payload) {
  return request('/update-template', { method: 'PUT', auth: true, body: payload })
}

export async function deleteTemplate(payload) {
  return request('/delete-template', { method: 'DELETE', auth: true, body: payload })
}

// Admin-only template delete. Backend enforces role === 'admin' here so the
// artist-owned /delete-template endpoint doesn't reject the request.
export async function adminDeleteTemplate(templateId) {
  return request(`/admin/templates/${templateId}`, { method: 'DELETE', auth: true })
}

// Admin template review — list everything, approve, or reject a submission.
export async function getAdminTemplates(query = 'page=1&limit=100') {
  return request(`/admin/templates?${query}`, { auth: true })
}

export async function approveTemplate(templateId) {
  return request(`/admin/templates/${templateId}/approve`, { method: 'PATCH', auth: true })
}

export async function rejectTemplate(templateId, reason = '') {
  return request(`/admin/templates/${templateId}/reject`, {
    method: 'PATCH',
    auth: true,
    body: { reason },
  })
}


/* ═══════════════════════════════════════════════
   ANONYMOUS INBOX
   ═══════════════════════════════════════════════ */
export async function sendAnonymousMessage(payload) {
  // POST /cards/:slug/anonymous-message per handbook — recipient's anon card slug required
  // payload: { slug, message }
  return request(`/cards/${payload.slug}/anonymous-message`, { method: 'POST', body: { message: payload.message } })
    .catch(() => ({ ok: false, message: 'Anonymous messaging not yet available.' }))
}

export async function getAnonMessages() {
  // Not in the current backend handbook — returns empty until backend adds this route
  return Promise.resolve({ messages: [] })
}

export async function deleteAnonMessage() {
  // Not in the current backend handbook
  return Promise.resolve({ ok: false })
}

/* ═══════════════════════════════════════════════
   ARTIST
   ═══════════════════════════════════════════════ */
export async function artistApply(payload) {
  return request('/artistapply', { method: 'POST', auth: true, body: payload })
}

/* ═══════════════════════════════════════════════
   ANALYTICS
   ═══════════════════════════════════════════════ */
export async function getUserAnalytics() {
  return request('/user-analytics', { auth: true })
}

export async function getCardAnalytics(slug) {
  return request(`/card-analytics/${slug}`, { auth: true })
}

/* ═══════════════════════════════════════════════
   CURRENCY
   ═══════════════════════════════════════════════ */
export async function getCurrencies() {
  return request('/api/currencies')
}

export async function getCurrencyRates(from, to) {
  return request(`/api/currency/rates/${from}/${to}`)
}

export async function getPrices(currency) {
  return request(`/api/prices/${currency}`)
}

export async function updateCurrency(payload) {
  return request('/update-currency', { method: 'PUT', auth: true, body: payload })
}

export async function getUserCurrency() {
  return request('/api/user-currency', { auth: true })
}

/* ═══════════════════════════════════════════════
   ADMIN
   ═══════════════════════════════════════════════ */
export async function getAdminDashboard() {
  return request('/admin/dashboard', { auth: true })
}

export async function getAdminUsers(query = 'page=1&limit=100') {
  return request(`/admin/users?${query}`, { auth: true })
}

export async function getAdminArtistApplications(query = 'page=1&limit=50') {
  return request(`/admin/artist-applications?${query}`, { auth: true })
}

export async function acceptArtistApplication(applicationId) {
  return request(`/admin/artist-applications/${applicationId}/accept`, { method: 'POST', auth: true })
}

export async function getAdminCoupons(query = 'page=1&limit=20') {
  return request(`/admin/coupons?${query}`, { auth: true })
}

export async function getAdminActionLogs(query = 'page=1&limit=100') {
  return request(`/admin/action-logs?${query}`, { auth: true })
}

export async function banUser(payload) {
  return request('/admin/ban-user', { method: 'POST', auth: true, body: payload })
}

export async function unbanUser(payload) {
  return request('/admin/unban-user', { method: 'POST', auth: true, body: payload })
}

export async function setUserRole(payload) {
  return request('/admin/users/set-role', { method: 'POST', auth: true, body: payload })
}

export async function getAdminReports(query = 'page=1&limit=50') {
  return request(`/admin/reports?${query}`, { auth: true })
}

export async function getPublicProfile(identifier) {
  return request(`/users/${identifier}/profile`, { auth: true })
}

export async function submitBroadcastRequest(payload) {
  return request('/admin/broadcast-requests', { method: 'POST', auth: true, body: payload })
}

export async function approveBroadcastRequest(requestId) {
  return request(`/admin/broadcast-requests/${requestId}/approve`, { method: 'POST', auth: true })
}

export async function getModeratorActionLogs(query = 'page=1&limit=100') {
  return request(`/admin/moderator-action-logs?${query}`, { auth: true })
}

export async function disableAdminTemplate(templateId) {
  return request(`/admin/templates/${templateId}/disable`, { method: 'PATCH', auth: true })
}

export async function getEnterpriseAdStats() {
  return request('/ads/enterprise-stats', { auth: true })
}

export async function getAdminTemplatesLookup(query = '') {
  return request(`/admin/templates/lookup?${query}`, { auth: true })
}

export async function reportUser(targetId, reason, details = '') {
  return request('/reports/users', { method: 'POST', auth: true, body: { targetId, reason, details } })
}

export async function reportCard(targetId, reason, details = '') {
  return request('/reports/cards', { method: 'POST', auth: true, body: { targetId, reason, details } })
}

export async function reportTemplate(targetId, reason, details = '') {
  return request('/reports/templates', { method: 'POST', auth: true, body: { targetId, reason, details } })
}

export async function createAdminPackage(payload) {
  return request('/admin/packages', { method: 'POST', auth: true, body: payload })
}

export async function getAdminPackages(query = 'page=1&limit=50') {
  return request(`/admin/packages?${query}`, { auth: true })
}

export async function updateAdminPackage(packageId, payload) {
  return request(`/admin/packages/${packageId}`, { method: 'PUT', auth: true, body: payload })
}

export async function deleteAdminPackage(packageId) {
  return request(`/admin/packages/${packageId}`, { method: 'DELETE', auth: true })
}

export async function createAdminRedeemCode(payload) {
  return request('/admin/redeem-codes', { method: 'POST', auth: true, body: payload })
}

export async function getAdminRedeemCodes(query = 'page=1&limit=50') {
  return request(`/admin/redeem-codes?${query}`, { auth: true })
}

export async function disableAdminRedeemCode(code) {
  return request('/admin/redeem-codes/disable', { method: 'PATCH', auth: true, body: { code } })
}

export async function enableAdminRedeemCode(code) {
  return request('/admin/redeem-codes/enable', { method: 'PATCH', auth: true, body: { code } })
}

export async function deleteAdminRedeemCode(code) {
  return request('/admin/redeem-codes', { method: 'DELETE', auth: true, body: { code } })
}

export async function sendSeasonalReminder(payload) {
  return request('/admin/send-seasonal-reminder', { method: 'POST', auth: true, body: payload })
}

export async function sendAdminBroadcast(payload) {
  return request('/admin/broadcast-message', { method: 'POST', auth: true, body: payload })
}

export async function getAdminStatsOverview() {
  return request('/admin/stats/overview', { auth: true })
}

export async function getAdminStatsUsers() {
  return request('/admin/stats/users', { auth: true })
}

export async function getAdminStatsCards() {
  return request('/admin/stats/cards', { auth: true })
}

export async function getAdminStatsTemplates() {
  return request('/admin/stats/templates', { auth: true })
}

export async function getAdminStatsReferrals() {
  return request('/admin/stats/referrals', { auth: true })
}

export async function createAdminAd(payload) {
  return request('/admin/ads', { method: 'POST', auth: true, body: payload })
}

export async function updateAdminAd(adId, payload) {
  return request(`/admin/ads/${adId}`, { method: 'PATCH', auth: true, body: payload })
}

export async function getAdminAds() {
  return request('/admin/ads', { auth: true })
}

export async function getAdminAdsAnalytics() {
  return request('/admin/ads/analytics', { auth: true })
}

export async function deleteAdminAd(adId) {
  return request(`/admin/ads/${adId}`, { method: 'DELETE', auth: true })
}

export async function getAdminAdsGlobalStats() {
  return request('/admin/ads/global-stats', { auth: true })
}

export async function getAdminAdsEnterpriseStats() {
  return request('/admin/ads/enterprise-stats', { auth: true })
}

/* ═══════════════════════════════════════════════
   TIER-SPECIFIC CARD CREATION
   ═══════════════════════════════════════════════ */
export async function createCardClassic(payload) {
  return request('/create-card/classic', { method: 'POST', auth: true, body: payload })
}

export async function createCardPremium(payload) {
  return request('/create-card/premium', { method: 'POST', auth: true, body: payload })
}

export async function createCardElite(payload) {
  return request('/create-card/elite', { method: 'POST', auth: true, body: payload })
}

export async function createCardAnonymous(payload) {
  return request('/create-card/anonymous', { method: 'POST', auth: true, body: payload })
}

export async function createCardPollClassic(payload) {
  return request('/create-card/poll/classic', { method: 'POST', auth: true, body: payload })
}

export async function createCardPollElite(payload) {
  return request('/create-card/poll/elite', { method: 'POST', auth: true, body: payload })
}

export async function createCardChainClassic(payload) {
  return request('/create-card/chain/classic', { method: 'POST', auth: true, body: payload })
}

export async function createCardChainElite(payload) {
  return request('/create-card/chain/elite', { method: 'POST', auth: true, body: payload })
}

export async function createCardTriviaClassic(payload) {
  return request('/create-card/trivia/classic', { method: 'POST', auth: true, body: payload })
}

export async function createCardTriviaElite(payload) {
  return request('/create-card/trivia/elite', { method: 'POST', auth: true, body: payload })
}

export async function createCardAnonClassic(payload) {
  return request('/create-card/anonymous/classic', { method: 'POST', auth: true, body: payload })
}

export async function createCardAnonElite(payload) {
  return request('/create-card/anonymous/elite', { method: 'POST', auth: true, body: payload })
}

export async function useCouponCreateCard(payload) {
  return request('/use-coupon-create-card', { method: 'POST', auth: true, body: payload })
}

/* ═══════════════════════════════════════════════
   CARD ANONYMOUS MESSAGES
   ═══════════════════════════════════════════════ */
export async function sendCardAnonymousMessage(slug, body) {
  return request(`/cards/${slug}/anonymous-message`, { method: 'POST', body })
}

/* ═══════════════════════════════════════════════
   MEDIA MANAGEMENT
   ═══════════════════════════════════════════════ */
export async function getMediaVideos() {
  return request('/media/videos', { auth: true })
}

export async function uploadMediaVideo(payload) {
  return request('/media/videos', { method: 'POST', auth: true, body: payload })
}

export async function deleteMediaVideo(nameKey) {
  return request('/media/videos', { method: 'DELETE', auth: true, body: { nameKey } })
}

export async function getMediaMusic() {
  return request('/media/music', { auth: true })
}

export async function uploadMediaMusic(payload) {
  return request('/media/music', { method: 'POST', auth: true, body: payload })
}

export async function deleteMediaMusic(nameKey) {
  return request('/media/music', { method: 'DELETE', auth: true, body: { nameKey } })
}

// Patch a music track — currently used to persist trim points (startSec /
// endSec) and rename. Backend may store these as extra fields on the record;
// the FE audio player honours them when present.
export async function updateMediaMusic(id, payload) {
  return request(`/media/music/${id}`, { method: 'PATCH', auth: true, body: payload })
}

export { API_BASE }
