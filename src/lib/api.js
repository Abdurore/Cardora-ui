const DEFAULT_API_BASE = 'https://cardora-dmut.onrender.com'
const API_BASE = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE).replace(/\/+$/, '')
const TOKEN_KEY = 'cardora:authToken'
const GUEST_ID_KEY = 'cardora:guestId'

// A stable per-browser id for unauthenticated visitors (e.g. recipients answering
// a card without an account). Without this, guests are only distinguishable by IP,
// which collides everyone on the same network/NAT into a single "user".
function getGuestId() {
  try {
    let id = localStorage.getItem(GUEST_ID_KEY)
    if (!id) {
      id = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `g-${Date.now()}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem(GUEST_ID_KEY, id)
    }
    return id
  } catch {
    return ''
  }
}

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

// 4.3: back to localStorage. The tab-scoped sessionStorage design existed
// only to stop a second account logging in on another tab from clobbering
// the first tab's session and its World Chat socket auth (a shared token
// meant one tab's reconnect could silently switch to whichever account
// logged in most recently, elsewhere). With World Chat deleted that
// constraint no longer applies -- and sessionStorage was logging every user
// out on tab close in the meantime, a real retention cost for a product
// people return to weeks apart.
export function getStoredToken() {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) return token
  // One-time migration: carry over a pre-existing sessionStorage session
  // (from before this change) into localStorage, then stop reading it.
  const legacyToken = sessionStorage.getItem(TOKEN_KEY)
  if (legacyToken) {
    localStorage.setItem(TOKEN_KEY, legacyToken)
    sessionStorage.removeItem(TOKEN_KEY)
    return legacyToken
  }
  return null
}

export function setStoredToken(token) {
  if (!token) return
  localStorage.setItem(TOKEN_KEY, token)
  sessionStorage.removeItem(TOKEN_KEY)
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
}

async function request(path, { method = 'GET', body, auth = false, headers = {}, timeout = 30000 } = {}) {
  const url = buildUrl(path)
  const token = getStoredToken()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  let response
  try {
    response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Guest-Id': getGuestId(),
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (fetchErr) {
    clearTimeout(timer)
    if (fetchErr.name === 'AbortError') {
      const err = new Error('Connection timed out — please try again.')
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

// requestFirstSuccess (the multi-candidate-path waterfall helper) was
// removed in Phase 2.3 -- every call site was collapsed to the one real
// backend path, and this had no remaining callers.

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

export async function equipProfileBackground(backgroundId, blur = false) {
  return request('/users/equip-profile-background', { method: 'PATCH', auth: true, body: { backgroundId, blur } })
}

export async function getProfileBackgrounds() {
  // Phase 2.3: confirmed real (userRoutes.js registers this exact path,
  // and a duplicate of it at /users/profile-backgrounds -- picking the
  // shorter one). /admin/profile-backgrounds is a different, admin-only
  // CRUD endpoint, not a second listing path for this.
  return request('/profile-backgrounds', { auth: true })
}

export async function createProfileBackground(payload) {
  return request('/admin/profile-backgrounds', { method: 'POST', auth: true, body: payload })
}

export async function deleteProfileBackground(backgroundId) {
  return request(`/admin/profile-backgrounds/${encodeURIComponent(backgroundId)}`, { method: 'DELETE', auth: true })
}

/* ═══════════════════════════════════════════════
   CARDS
   ═══════════════════════════════════════════════ */
export async function deleteCard(payload) {
  const cardId = payload?.cardId || payload?.id
  try {
    return await request('/delete-card', { method: 'DELETE', auth: true, body: { cardId, id: cardId } })
  } catch (err) {
    if (cardId && [404, 405].includes(err.status)) {
      return request(`/delete-card/${encodeURIComponent(cardId)}`, { method: 'DELETE', auth: true })
    }
    throw err
  }
}

export async function getCardPrices() {
  return request('/cards/prices')
}

// 5.5: first-open claim. The claiming device gets a server-signed token
// back in the response, persisted here per-slug; every later fetch of the
// same card sends it back so the server can tell "the original claimant
// reopening" apart from "a different device" -- see cardController.js's
// getCardBySlug for why this can't just be the client-suppliable
// X-Guest-Id header.
function claimTokenStorageKey(slug) {
  return `cardora:claimToken:${slug}`
}

function getStoredClaimToken(slug) {
  try {
    return localStorage.getItem(claimTokenStorageKey(slug)) || ''
  } catch {
    return ''
  }
}

function storeClaimTokenIfPresent(slug, response) {
  const token = response?.claimToken || response?.data?.claimToken
  if (!token) return response
  try {
    localStorage.setItem(claimTokenStorageKey(slug), token)
  } catch { /* ignore */ }
  return response
}

export async function getCardBySlug(slug, password) {
  const qs = password ? `?password=${encodeURIComponent(password)}` : ''
  const claimToken = getStoredClaimToken(slug)
  // auth when a session exists: without the bearer token the backend can't
  // tell a sender checking their own link from a stranger, so it treated
  // the sender as the recipient -- claimed the Personal Card for the
  // sender's device (the real recipient then got "already opened"),
  // counted a view, and notified the sender that their own card was opened.
  const response = await request(`/cards/${slug}${qs}`, {
    auth: !!getStoredToken(),
    headers: claimToken ? { 'X-Claim-Token': claimToken } : {},
  })
  return storeClaimTokenIfPresent(slug, response)
}

export async function getMyCard(slug) {
  return request(`/cards/${slug}`, { auth: true })
}

// 5.5: sender-only card management.
export async function revokeCard(slug, revoked = true) {
  return request(`/cards/${slug}/revoke`, { method: 'POST', auth: true, body: { revoked } })
}

export async function releaseCardClaim(slug) {
  const result = await request(`/cards/${slug}/release-claim`, { method: 'POST', auth: true })
  try {
    localStorage.removeItem(claimTokenStorageKey(slug))
  } catch { /* ignore */ }
  return result
}

// 6.3: public -- a recipient who lands on a not-yet-unlocked scheduled card
// can leave an email with no account required.
export async function notifyMeForScheduledCard(slug, email) {
  return request(`/cards/${slug}/notify-me`, { method: 'POST', body: { email } })
}

// 6.4: originator moderation -- owner-only, removes one chain entry
// outright (no tombstone left behind).
export async function deleteChainEntry(slug, entryId) {
  return request(`/cards/${slug}/chain-entries/${entryId}`, { method: 'DELETE', auth: true })
}

// Phase 2.3: all four of these used to try 4-8 candidate paths each,
// confirmed against Backend/Cardora/src/routes/cardRoutes.js -- exactly one
// path is ever registered for any of them (no `/public/cards/...` prefix
// exists anywhere in the backend, and none of the alternate action-word
// spellings do either).
export async function submitCardResponse(slug, body) {
  const hasAuth = !!getStoredToken()
  return request(`/cards/${slug}/response`, { method: 'POST', auth: hasAuth, body })
}

export async function submitPollVote(slug, body) {
  const hasAuth = !!getStoredToken()
  return request(`/cards/${slug}/poll-vote`, { method: 'POST', auth: hasAuth, body })
}

export async function submitChainReply(slug, body) {
  const hasAuth = !!getStoredToken()
  return request(`/cards/${slug}/chain-reply`, { method: 'POST', auth: hasAuth, body })
}

export async function submitTriviaAnswer(slug, body) {
  const hasAuth = !!getStoredToken()
  return request(`/cards/${slug}/trivia-submit`, { method: 'POST', auth: hasAuth, body })
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

export async function createPremiumCheckout(payload = {}) {
  return request('/create-premium-checkout', { method: 'POST', auth: true, body: payload })
}

// 6.9: polled by Store.jsx after landing back on ?reference=... from Paystack.
export async function getPaymentSessionStatus(reference) {
  return request(`/payments/status/${encodeURIComponent(reference)}`, { auth: true })
}

export async function giftPremium(username) {
  return request('/gift-premium', { method: 'POST', auth: true, body: { username } })
}

/* ═══════════════════════════════════════════════
   GIFTS — purchase/checkout removed (4.1, -> v2 CC-denominated). Attach/
   claim stay: a card that already has a gift attached still renders and
   can still be claimed.
   ═══════════════════════════════════════════════ */
export async function attachGiftToCard(payload) {
  return request('/cards/attach-gift', { method: 'POST', auth: true, body: payload })
}

export async function claimGiftFromCard(slug) {
  return request(`/cards/${slug}/claim-gift`, { method: 'POST', auth: true })
}

/* ═══════════════════════════════════════════════
   3.7 CC SINKS — spend CC to modify a card you own
   ═══════════════════════════════════════════════ */
export async function extendCardLifetime(cardId) {
  return request(`/cards/${encodeURIComponent(cardId)}/extend-lifetime`, { method: 'POST', auth: true })
}

export async function setCardVanityLink(cardId, vanitySlug) {
  return request(`/cards/${encodeURIComponent(cardId)}/vanity-link`, { method: 'POST', auth: true, body: { vanitySlug } })
}

export async function removeCardBranding(cardId) {
  return request(`/cards/${encodeURIComponent(cardId)}/remove-branding`, { method: 'POST', auth: true })
}

// boostType: 'cap' | 'window' | 'prompts'
export async function boostAnonymousInbox(cardId, boostType) {
  return request(`/cards/${encodeURIComponent(cardId)}/boost-inbox`, { method: 'POST', auth: true, body: { boostType } })
}

export async function raiseCardViewCap(cardId) {
  return request(`/cards/${encodeURIComponent(cardId)}/raise-view-cap`, { method: 'POST', auth: true })
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

// 3.6: redeem a non-currency ad-reward grant (view_boost / lifetime_extension
// -- premium_feature applies automatically on the next card created, nothing
// to redeem here for that type).
export async function redeemAdRewardGrant(payload) {
  return request('/ads/redeem-grant', { method: 'POST', auth: true, body: payload })
}

// Phase 2.3: confirmed against Backend/Cardora/src/routes/adRoutes.js and
// adminRoutes.js -- NONE of the candidates either of these two functions
// tried ever existed (adRoutes.js only registers /rewarded, /complete,
// /stats, /enterprise-stats; there is no click/view-tracking route
// anywhere in the backend, user-facing or admin). Every call from both of
// these has always 404'd, silently, since both call sites in
// RewardedAds.jsx swallow the error into a console.warn. This is a real
// backend gap, not a routing-path guess to fix here -- reduced to one call
// each (stops five wasted requests becoming one) but left clearly flagged
// rather than pointed at a URL invented for this pass. Needs either a real
// click/view-tracking endpoint built on the backend, or these calls (and
// the enterprise ad-analytics features that would depend on them) removed
// from the frontend as dead weight.
export async function clickAd(adId) {
  return request(`/ads/${adId}/click`, { method: 'POST', auth: true, body: { adId, id: adId, action: 'click' } })
}

export async function trackAdView(adId) {
  return request(`/ads/${adId}/view`, { method: 'POST', auth: true, body: { adId, id: adId, action: 'view' } })
}

/* ═══════════════════════════════════════════════
   TEMPLATES
   ═══════════════════════════════════════════════ */
export async function getTemplates(query = 'page=1&limit=24') {
  // auth:true (not required=true) — request() only attaches the token if one
  // exists, so guests still hit this as a public route. Logged-in users need
  // it so the backend can resolve per-viewer isLiked state.
  return request(`/templates?${query}`, { auth: true })
}

export async function getMyTemplates() {
  return request('/my-templates', { auth: true })
}

export async function getPopularTemplates(query = 'days=7&page=1&limit=10') {
  return request(`/templates/popular?${query}`, { auth: true })
}

export async function getTemplateById(id) {
  return request(`/templates/${id}`, { auth: true })
}

export async function likeTemplate(templateId) {
  return request(`/templates/${templateId}/like`, { method: 'POST', auth: true })
}

export async function unlikeTemplate(templateId) {
  return request(`/templates/${templateId}/unlike`, { method: 'POST', auth: true })
}

export async function trackTemplateView(templateId) {
  return request(`/templates/${templateId}/view`, { method: 'POST', auth: true })
}

export async function trackTemplateUse(templateId) {
  return request(`/templates/${templateId}/use`, { method: 'POST', auth: true })
}

export async function createTemplate(payload) {
  return request('/create-template', { method: 'POST', auth: true, body: payload })
}

export async function updateTemplate(payload) {
  return request('/update-template', { method: 'PUT', auth: true, body: payload })
}

// 3.7: unlock a priced marketplace template permanently for the current user.
export async function unlockTemplate(templateId) {
  const id = encodeURIComponent(templateId)
  return request(`/templates/${id}/unlock`, { method: 'POST', auth: true })
}

export async function deleteTemplate(payload) {
  const templateId = payload?.templateId || payload?.id || payload?._id || (typeof payload === 'string' ? payload : '')
  if (!templateId) {
    throw new Error('Template ID is required for deletion.')
  }
  return request(`/delete-template/${encodeURIComponent(templateId)}`, { method: 'DELETE', auth: true })
}

// Admin-only template delete. Backend enforces role === 'admin' here so the
// artist-owned /delete-template endpoint doesn't reject the request.
export async function adminDeleteTemplate(templateId) {
  try {
    return await request(`/admin/templates/${encodeURIComponent(templateId)}`, { method: 'DELETE', auth: true })
  } catch (err) {
    if ([404, 405].includes(err.status)) {
      return request('/admin/templates', { method: 'DELETE', auth: true, body: { templateId, id: templateId, _id: templateId } })
    }
    throw err
  }
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
   ARTISTS
   ═══════════════════════════════════════════════ */
export async function getArtists(query = 'page=1&limit=20') {
  return request(`/artists?${query}`)
}

export async function getArtistById(id) {
  return request(`/artists/${id}`)
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

// Live backend route (analyticsRoutes.js), but currently unused by any page:
// Profile.jsx once held per-slug fetch/caching state for it that nothing ever
// called or rendered, so that dead half was removed. This wrapper is kept
// because the endpoint works — wire it up when the per-card analytics UI lands.
export async function getCardAnalytics(slug) {
  return request(`/card-analytics/${encodeURIComponent(slug)}`, { auth: true })
}

/* ═══════════════════════════════════════════════
   CURRENCY
   ═══════════════════════════════════════════════ */
export async function getCurrencies() {
  return request('/api/currencies')
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

export async function updateAdminReportStatus(reportId, status) {
  return request(`/admin/reports/${reportId}/status`, { method: 'PATCH', auth: true, body: { status } })
}

export async function getPublicProfile(identifier) {
  return request(`/users/${identifier}/profile`, { auth: true })
}

// 6.6: durable anonymous link -- public, no account required to resolve
// someone's /ask/:username to their currently-active anonymous card.
export async function getActiveAnonymousCard(username) {
  return request(`/users/${username}/anonymous-card`)
}

// 6.6: owner-only -- points the caller's /ask/:username at a different one
// of their own anonymous cards ("rotate the card underneath").
export async function setActiveAnonymousCard(cardId) {
  return request('/users/me/active-anonymous-card', { method: 'POST', auth: true, body: { cardId } })
}

export async function submitBroadcastRequest(payload) {
  return request('/admin/broadcast-requests', { method: 'POST', auth: true, body: payload })
}

export async function approveBroadcastRequest(requestId) {
  return request(`/admin/broadcast-requests/${requestId}/approve`, { method: 'POST', auth: true })
}

export async function rejectBroadcastRequest(requestId) {
  return request(`/admin/broadcast-requests/${requestId}/reject`, { method: 'POST', auth: true })
}

export async function getBroadcastRequests(query = 'status=pending&page=1&limit=100') {
  return request(`/admin/broadcast-requests?${query}`, { auth: true })
}

export async function getModeratorActionLogs(query = 'page=1&limit=100') {
  return request(`/admin/moderator-action-logs?${query}`, { auth: true })
}

export async function disableAdminTemplate(templateId, payload = {}) {
  const id = encodeURIComponent(templateId)
  const body = typeof payload === 'number'
    ? { durationDays: payload }
    : { ...payload }
  try {
    return await request(`/admin/templates/${id}/disable`, { method: 'PATCH', auth: true, body })
  } catch (err) {
    if ([400, 422].includes(err.status)) {
      return request(`/admin/templates/${id}/disable`, { method: 'PATCH', auth: true })
    }
    throw err
  }
}

export async function enableAdminTemplate(templateId) {
  const id = encodeURIComponent(templateId)
  // 3.7: PATCH /admin/templates/:id/enable now exists (adminController.js's
  // enableTemplate) -- Phase 2.3 found this endpoint missing entirely; the
  // fix is folded into 3.7's marketplace-template work per direction.
  return request(`/admin/templates/${id}/enable`, { method: 'PATCH', auth: true })
}

export async function getEnterpriseAdStats() {
  // Phase 2.3: confirmed real (adRoutes.js registers exactly this path).
  return request('/ads/enterprise-stats', { auth: true })
}

export async function reportUser(targetId, reason, details = '') {
  return request('/reports/users', { method: 'POST', auth: true, body: { targetId, reason, details } })
}

// 6.4: entryId lets a chain-card report identify which specific
// contributor entry it's about, alongside the card itself.
export async function reportCard(targetId, reason, details = '', entryId = null) {
  return request('/reports/cards', { method: 'POST', auth: true, body: { targetId, reason, details, ...(entryId ? { entryId } : {}) } })
}

export async function reportTemplate(targetId, reason, details = '') {
  return request('/reports/templates', { method: 'POST', auth: true, body: { targetId, templateId: targetId, type: 'template', targetType: 'template', reason, details } })
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

// The admin "broadcast to all users" action. There is no /admin/broadcast-message
// route on the backend (only this one plus the /admin/broadcast-requests approval
// endpoints), so this is the endpoint that actually mails every user — don't add a
// `sendAdminBroadcast` stub back and wire the button to it, it will 404.
export async function sendSeasonalReminder(payload) {
  return request('/admin/send-seasonal-reminder', { method: 'POST', auth: true, body: payload })
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

// Card funnel dashboard: Created -> Sent -> Opened -> Completed, with
// counts and stage-to-stage conversion. { from, to } are ISO date strings;
// omitted defaults to the last 7 days server-side. cardType is optional.
export async function getAdminCardFunnel({ from, to, cardType } = {}) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  if (cardType) params.set('cardType', cardType)
  const qs = params.toString()
  return request(`/admin/stats/card-funnel${qs ? `?${qs}` : ''}`, { auth: true })
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

/* ═══════════════════════════════════════════════
   CARD ANONYMOUS MESSAGES
   ═══════════════════════════════════════════════ */
export async function sendCardAnonymousMessage(slug, body) {
  return request(`/cards/${slug}/anonymous-message`, { method: 'POST', body })
}

/* ═══════════════════════════════════════════════
   CARD REACTIONS
   ═══════════════════════════════════════════════ */
export async function reactToCard(slug, emoji, password) {
  const hasAuth = !!getStoredToken()
  return request(`/cards/${slug}/react`, { method: 'POST', auth: hasAuth, body: { emoji, password } })
}

/* ═══════════════════════════════════════════════
   MEDIA MANAGEMENT
   ═══════════════════════════════════════════════ */
export async function getMediaVideos() {
  return request('/media/videos')
}

export async function uploadMediaVideo(payload) {
  return request('/media/videos', { method: 'POST', auth: true, body: payload })
}

export async function deleteMediaVideo(nameKey) {
  try {
    return await request('/media/videos', { method: 'DELETE', auth: true, body: { nameKey } })
  } catch (err) {
    if (nameKey && [404, 405].includes(err.status)) {
      return request(`/media/videos/${encodeURIComponent(nameKey)}`, { method: 'DELETE', auth: true })
    }
    throw err
  }
}

export async function getMediaMusic() {
  return request('/media/music')
}

export async function uploadMediaMusic(payload) {
  return request('/media/music', { method: 'POST', auth: true, body: payload })
}

export async function deleteMediaMusic(nameKey) {
  try {
    return await request('/media/music', { method: 'DELETE', auth: true, body: { nameKey } })
  } catch (err) {
    if (nameKey && [404, 405].includes(err.status)) {
      return request(`/media/music/${encodeURIComponent(nameKey)}`, { method: 'DELETE', auth: true })
    }
    throw err
  }
}

// Patch a music track — currently used to persist trim points (startSec /
// endSec) and rename. Backend may store these as extra fields on the record;
// the FE audio player honours them when present.
export async function updateMediaMusic(id, payload) {
  return request(`/media/music/${id}`, { method: 'PATCH', auth: true, body: payload })
}

/* ═══════════════════════════════════════════════
   ADMIN: SIGNUP BONUS
   ═══════════════════════════════════════════════ */
export async function getSignupBonusStatus() {
  return request('/admin/signup-bonus-status', { auth: true })
}

export async function resetSignupBonus() {
  return request('/admin/reset-signup-bonus', { method: 'POST', auth: true })
}

/* ═══════════════════════════════════════════════
   ADMIN: GIFT MANAGEMENT
   ═══════════════════════════════════════════════ */
export async function createAdminGift(payload) {
  return request('/admin/gifts', { method: 'POST', auth: true, body: payload })
}

export async function getAdminGifts() {
  return request('/admin/gifts', { auth: true })
}

export async function deleteAdminGift(giftId) {
  return request(`/admin/gifts/${encodeURIComponent(giftId)}`, { method: 'DELETE', auth: true })
}

/* ═══════════════════════════════════════════════
   ADMIN: BROADCAST DELIVERY LOGS
   ═══════════════════════════════════════════════ */
export async function getBroadcastDeliveryLogs({ broadcastId, page = 1, limit = 100 } = {}) {
  const qs = new URLSearchParams({ broadcastId, page, limit }).toString()
  return request(`/admin/broadcast-delivery-logs?${qs}`, { auth: true })
}

/* ═══════════════════════════════════════════════
   6.1: CREATION-FUNNEL INSTRUMENTATION
   ═══════════════════════════════════════════════ */
// Fire-and-forget by design -- a dropped analytics event must never surface
// as an error or slow down someone actually creating a card. Swallows its
// own failures rather than letting request()'s console.error/toast-worthy
// error path fire for something the user never asked for and can't act on.
export function trackEvent(event, properties = {}) {
  request('/analytics/events', { method: 'POST', body: { event, properties } }).catch(() => {})
}

/* ═══════════════════════════════════════════════
   6.2: OCCASION REMINDERS & NOTIFICATIONS
   ═══════════════════════════════════════════════ */
export async function createReminder(payload) {
  return request('/reminders', { method: 'POST', auth: true, body: payload })
}

export async function getReminders() {
  return request('/reminders', { auth: true })
}

export async function deleteReminder(id) {
  return request(`/reminders/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true })
}

export async function getNotifications() {
  return request('/notifications', { auth: true })
}

export async function markNotificationRead(id) {
  return request(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH', auth: true })
}

/* ═══════════════════════════════════════════════
   6.8: WEB PUSH SUBSCRIPTIONS
   ═══════════════════════════════════════════════ */
// Backend's Joi schema (userSchemas.subscribeToPush) is allowUnknown:false on
// exactly {endpoint, keys:{p256dh,auth}} -- PushSubscription.toJSON() also
// includes expirationTime, so callers must pass that trimmed shape, not the
// raw subscription object, or this 400s.
export async function subscribeToPush(subscription) {
  return request('/users/me/push-subscription', { method: 'POST', auth: true, body: subscription })
}

export async function unsubscribeFromPush(endpoint) {
  return request('/users/me/push-subscription', { method: 'DELETE', auth: true, body: { endpoint } })
}

export { API_BASE }
