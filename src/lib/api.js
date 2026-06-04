import { getChatFrameId, getChatFrameUrl } from './chatFrames.js'

const DEFAULT_API_BASE = 'https://cardora-uss3.onrender.com'
const API_BASE = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE).replace(/\/+$/, '')
const TOKEN_KEY = 'cardora:authToken'
const CHAT_FRAME_CACHE_KEY = 'cardora:adminChatFrames'

function readStorageJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function getCachedChatFrames() {
  const frames = readStorageJson(CHAT_FRAME_CACHE_KEY, [])
  return Array.isArray(frames) ? frames : []
}

export function rememberChatFrame(frame) {
  if (!frame || typeof frame !== 'object') return
  const id = getChatFrameId(frame)
  const url = getChatFrameUrl(frame)
  if (!id || !url) return
  const nextFrame = {
    ...frame,
    id,
    url,
    imageUrl: frame.imageUrl || url,
    price: frame.price ?? frame.priceCC ?? frame.cost ?? 0,
  }
  const frames = getCachedChatFrames()
  const existingIndex = frames.findIndex(item => (item.id || item.frameId || item._id) === id)
  const next = existingIndex >= 0
    ? frames.map((item, index) => (index === existingIndex ? { ...item, ...nextFrame } : item))
    : [nextFrame, ...frames]
  try {
    localStorage.setItem(CHAT_FRAME_CACHE_KEY, JSON.stringify(next))
  } catch { /* storage can be unavailable in private contexts */ }
}

export function forgetCachedChatFrame(frameId) {
  if (!frameId) return
  const id = String(frameId)
  const frames = getCachedChatFrames()
  const next = frames.filter(item => getChatFrameId(item) !== id)
  try {
    localStorage.setItem(CHAT_FRAME_CACHE_KEY, JSON.stringify(next))
  } catch { /* storage can be unavailable in private contexts */ }
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

async function requestFirstSuccess(paths, options = {}) {
  let lastError = null
  for (const path of paths) {
    try {
      return await request(path, options)
    } catch (error) {
      lastError = error
      if (!error.status) throw error
      // Only try the next candidate when the route itself appears absent.
      // Validation/auth/card-type errors are real backend responses and should
      // not be hidden by later fallback 404 HTML pages.
      if (![404, 405].includes(error.status)) throw error
    }
  }
  throw lastError || new Error('Request failed.')
}

function pickChatFrameList(payload) {
  if (Array.isArray(payload)) return payload
  const root = payload?.data && typeof payload.data === 'object' ? payload.data : payload
  if (Array.isArray(root)) return root
  if (Array.isArray(root?.chatFrames)) return root.chatFrames
  if (Array.isArray(root?.frames)) return root.frames
  if (Array.isArray(root?.items)) return root.items
  if (Array.isArray(root?.data)) return root.data
  if (Array.isArray(root?.chatFrames?.docs)) return root.chatFrames.docs
  if (Array.isArray(root?.chatFrames?.items)) return root.chatFrames.items
  if (Array.isArray(root?.frames?.docs)) return root.frames.docs
  if (Array.isArray(root?.frames?.items)) return root.frames.items
  if (Array.isArray(root?.result?.chatFrames)) return root.result.chatFrames
  if (Array.isArray(root?.result?.frames)) return root.result.frames
  if (Array.isArray(root?.results)) return root.results
  if (root && typeof root === 'object') {
    for (const value of Object.values(root)) {
      if (!value || typeof value !== 'object') continue
      const nested = pickChatFrameList(value)
      if (nested.length) return nested
    }
  }
  return []
}

function chatFrameHasAsset(frame) {
  return Boolean(getChatFrameUrl(frame))
}

async function requestFirstChatFrames(paths, options = {}) {
  let lastError = null
  let firstSuccess = null
  for (const path of paths) {
    try {
      const payload = await request(path, options)
      if (!firstSuccess) firstSuccess = payload
      if (pickChatFrameList(payload).some(chatFrameHasAsset)) return payload
    } catch (error) {
      lastError = error
      if (!error.status) throw error
      if (![401, 403, 404, 405].includes(error.status)) throw error
    }
  }
  if (firstSuccess) return firstSuccess
  throw lastError || new Error('Request failed.')
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
export async function getCurrentUser(identifier) {
  const qs = identifier ? `?identifier=${encodeURIComponent(identifier)}` : ''
  return request(`/current-user${qs}`, { auth: true })
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

export async function completeFirstTimeUser() {
  return request('/users/first-time/complete', { method: 'PATCH', auth: true })
}

export async function equipProfileBackground(backgroundId, blur = false) {
  return request('/users/equip-profile-background', { method: 'PATCH', auth: true, body: { backgroundId, blur } })
}

export async function equipChatFrame(frameId) {
  if (typeof frameId === 'string' && frameId) {
    return request('/users/equip-chat-frame', { method: 'PATCH', auth: true, body: { frameId } })
  }
  const acceptedMissingRouteStatuses = [404, 405]
  try {
    return await request('/users/unequip-chat-frame', { method: 'PATCH', auth: true })
  } catch (firstError) {
    if (!acceptedMissingRouteStatuses.includes(firstError.status)) throw firstError
    try {
      return await request('/users/remove-chat-frame', { method: 'PATCH', auth: true })
    } catch (secondError) {
      if (!acceptedMissingRouteStatuses.includes(secondError.status)) throw secondError
      try {
        return await request('/users/chat-frame', { method: 'DELETE', auth: true })
      } catch (thirdError) {
        if (!acceptedMissingRouteStatuses.includes(thirdError.status)) throw thirdError
        return { ok: true, localOnly: true, message: 'Frame removed on this device.' }
      }
    }
  }
}

export async function buyChatFrame(frameId) {
  return request('/users/buy-chat-frame', { method: 'POST', auth: true, body: { frameId } })
}

export async function getProfileBackgrounds() {
  return requestFirstSuccess([
    '/profile-backgrounds',
    '/users/profile-backgrounds',
    '/admin/profile-backgrounds',
  ], { auth: true })
}

export async function createProfileBackground(payload) {
  return request('/admin/profile-backgrounds', { method: 'POST', auth: true, body: payload })
}

export async function deleteProfileBackground(backgroundId) {
  return request(`/admin/profile-backgrounds/${encodeURIComponent(backgroundId)}`, { method: 'DELETE', auth: true })
}

export async function getChatFrames() {
  return requestFirstChatFrames([
    '/admin/chat-frames?page=1&limit=500',
    '/admin/chat-frames',
    '/chat-frames?page=1&limit=500',
    '/chat-frames',
  ], { auth: true })
}

export async function getAdminChatFrames() {
  return requestFirstChatFrames([
    '/admin/chat-frames?page=1&limit=500',
    '/admin/chat-frames',
    '/chat-frames?page=1&limit=500',
    '/chat-frames',
  ], { auth: true })
}

export async function getOwnedChatFrames() {
  return requestFirstChatFrames([
    '/users/chat-frames',
  ], { auth: true }).catch(() => [])
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

export async function getCardBySlug(slug, password) {
  const qs = password ? `?password=${encodeURIComponent(password)}` : ''
  return request(`/cards/${slug}${qs}`)
}

export async function getMyCard(slug) {
  return request(`/cards/${slug}`, { auth: true })
}

export async function submitCardResponse(slug, body) {
  const hasAuth = !!getStoredToken()
  return requestFirstSuccess([
    `/cards/${slug}/response`,
    `/cards/${slug}/responses`,
    `/public/cards/${slug}/response`,
    `/public/cards/${slug}/responses`,
  ], { method: 'POST', auth: hasAuth, body })
}

export async function submitPollVote(slug, body) {
  const hasAuth = !!getStoredToken()
  return requestFirstSuccess([
    `/cards/${slug}/poll-vote`,
    `/cards/${slug}/poll/vote`,
    `/cards/${slug}/vote`,
    `/cards/${slug}/response`,
    `/public/cards/${slug}/poll-vote`,
    `/public/cards/${slug}/poll/vote`,
    `/public/cards/${slug}/vote`,
    `/public/cards/${slug}/response`,
  ], { method: 'POST', auth: hasAuth, body })
}

export async function submitChainReply(slug, body) {
  const hasAuth = !!getStoredToken()
  return requestFirstSuccess([
    `/cards/${slug}/chain-reply`,
    `/cards/${slug}/chain/reply`,
    `/cards/${slug}/reply`,
    `/cards/${slug}/response`,
    `/public/cards/${slug}/chain-reply`,
    `/public/cards/${slug}/chain/reply`,
    `/public/cards/${slug}/reply`,
    `/public/cards/${slug}/response`,
  ], { method: 'POST', auth: hasAuth, body })
}

export async function submitTriviaAnswer(slug, body) {
  const hasAuth = !!getStoredToken()
  return requestFirstSuccess([
    `/cards/${slug}/trivia-submit`,
    `/cards/${slug}/trivia/submit`,
    `/cards/${slug}/trivia-answer`,
    `/cards/${slug}/response`,
    `/public/cards/${slug}/trivia-submit`,
    `/public/cards/${slug}/trivia/submit`,
    `/public/cards/${slug}/trivia-answer`,
    `/public/cards/${slug}/response`,
  ], { method: 'POST', auth: hasAuth, body })
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

export async function createPremiumCheckout(payload = {}) {
  return request('/create-premium-checkout', { method: 'POST', auth: true, body: payload })
}

export async function giftPremium(username) {
  return request('/gift-premium', { method: 'POST', auth: true, body: { username } })
}

/* ═══════════════════════════════════════════════
   GIFTS (Flutterwave-backed)
   ═══════════════════════════════════════════════ */
export async function getGiftCatalog() {
  return request('/gifts/catalog')
}

export async function createFlutterwaveGiftCheckout(payload) {
  return requestFirstSuccess([
    '/gifts/flutterwave/checkout',
    '/gifts/checkout',
    '/create-gift-checkout',
    '/create-flutterwave-gift-checkout',
  ], { method: 'POST', auth: true, body: payload })
}

export async function attachGiftToCard(payload) {
  try {
    return await request('/cards/attach-gift', { method: 'POST', auth: true, body: payload })
  } catch (err) {
    const cardId = payload.cardId || payload.id || payload.slug
    if (cardId && (err.message?.includes('Card not found') || err.status === 404)) {
      console.log(`[api] Body-based attach failed, trying fallback URL route: /cards/${cardId}/attach-gift`)
      return await request(`/cards/${cardId}/attach-gift`, { method: 'POST', auth: true, body: payload })
    }
    throw err
  }
}

export async function claimGiftFromCard(slug) {
  return request(`/cards/${slug}/claim-gift`, { method: 'POST', auth: true })
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

export async function clickAd(adId) {
  return requestFirstSuccess([
    `/ads/${adId}/click`,
    `/ads/click`,
    `/ads/track-click`,
    `/ads/interaction`,
    `/admin/ads/${adId}/click`,
  ], { method: 'POST', auth: true, body: { adId, id: adId, action: 'click' } })
}

export async function trackAdView(adId) {
  return requestFirstSuccess([
    `/ads/${adId}/view`,
    `/ads/view`,
    `/ads/track-view`,
    `/ads/interaction`,
    `/admin/ads/${adId}/view`,
  ], { method: 'POST', auth: true, body: { adId, id: adId, action: 'view' } })
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

export async function getMyTemplates(userId) {
  try {
    return await request('/my-templates', { auth: true })
  } catch (err) {
    if (userId && (err.status === 404 || err.message?.includes('not found') || String(err.status) === '404')) {
      return await request(`/templates?artist=${encodeURIComponent(userId)}`, { auth: true })
    }
    throw err
  }
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

export async function trackTemplateView(templateId) {
  return requestFirstSuccess([
    `/templates/${templateId}/view`,
    `/templates/${templateId}/views`,
    `/templates/${templateId}/track-view`,
  ], { method: 'POST', auth: true })
}

export async function trackTemplateUse(templateId) {
  return requestFirstSuccess([
    `/templates/${templateId}/use`,
    `/templates/${templateId}/uses`,
    `/templates/${templateId}/track-use`,
  ], { method: 'POST', auth: true })
}

export async function createTemplate(payload) {
  return request('/create-template', { method: 'POST', auth: true, body: payload })
}

export async function updateTemplate(payload) {
  return request('/update-template', { method: 'PUT', auth: true, body: payload })
}

export async function deleteTemplate(payload) {
  const templateId = payload?.templateId || payload?.id || payload?._id || (typeof payload === 'string' ? payload : '')
  if (!templateId) {
    throw new Error('Template ID is required for deletion.')
  }

  const candidates = [
    { path: `/templates/${templateId}`, options: { method: 'DELETE', auth: true } },
    { path: `/delete-template/${encodeURIComponent(templateId)}`, options: { method: 'DELETE', auth: true } },
    { path: '/delete-template', options: { method: 'DELETE', auth: true, body: { templateId } } },
    { path: '/delete-template', options: { method: 'POST', auth: true, body: { id: templateId } } },
    { path: `/my-templates/${templateId}`, options: { method: 'DELETE', auth: true } },
    { path: `/artist/templates/${templateId}`, options: { method: 'DELETE', auth: true } },
  ]

  let lastError = null
  for (const item of candidates) {
    try {
      return await request(item.path, item.options)
    } catch (error) {
      lastError = error
      if (![404, 405, 400].includes(error.status)) throw error
    }
  }
  throw lastError || new Error('Could not delete template.')
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
   ANONYMOUS INBOX
   ═══════════════════════════════════════════════ */
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
  return requestFirstSuccess([
    `/admin/templates/${id}/enable`,
    `/admin/templates/${id}/restore`,
    `/admin/templates/${id}/reenable`,
  ], { method: 'PATCH', auth: true })
}

export async function getEnterpriseAdStats() {
  return requestFirstSuccess([
    '/ads/enterprise-stats',
    '/ads/enterprise/stats',
    '/enterprise/ads/stats',
    '/enterprise/ads',
    '/ads/my-stats',
  ], { auth: true })
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
   ADMIN: CHAT FRAMES
   ═══════════════════════════════════════════════ */
export async function createChatFrame(payload) {
  return request('/admin/chat-frames', { method: 'POST', auth: true, body: payload })
}

export async function deleteChatFrame(frameId) {
  const id = encodeURIComponent(frameId)
  return requestFirstSuccess([
    `/admin/chat-frames/${id}`,
    `/chat-frames/${id}`,
    `/admin/chat-frame/${id}`,
  ], { method: 'DELETE', auth: true })
}

export async function requestChatFrame(payload) {
  return request('/admin/chat-frame-requests', { method: 'POST', auth: true, body: payload })
}

export async function approveChatFrameRequest(requestId) {
  return request(`/admin/chat-frame-requests/${requestId}/approve`, { method: 'POST', auth: true })
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

export { API_BASE }
