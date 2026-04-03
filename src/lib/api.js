const API_BASE = 'https://cardora-uss3.onrender.com'
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
    return { message: text }
  }
}

function getErrorMessage(payload, fallback) {
  return (
    payload?.message ||
    payload?.error ||
    payload?.details ||
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

async function request(path, { method = 'GET', body, auth = false, headers = {} } = {}) {
  const url = buildUrl(path)
  const token = getStoredToken()
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await response.text()
  const payload = readJsonSafely(text)

  if (!response.ok) {
    const error = new Error(getErrorMessage(payload, 'Request failed.'))
    error.status = response.status
    error.payload = payload
    error.debug = {
      url,
      method,
      requestBody: sanitizeBody(body),
      responseBody: payload,
    }
    throw error
  }

  return payload
}

export async function signup(payload) {
  return request('/signup', { method: 'POST', body: payload })
}

export async function verifyEmail(payload) {
  return request('/verify-email', { method: 'POST', body: payload })
}

export async function requestOtp(payload) {
  return request('/request-otp', { method: 'POST', body: payload })
}

export async function login(payload) {
  return request('/login', { method: 'POST', body: payload })
}

export async function logout() {
  return request('/logout', { method: 'POST', auth: true })
}

export async function getCurrentUser() {
  return request('/current-user', { auth: true })
}

export async function getUserCoupons() {
  return request('/user/coupons', { auth: true })
}

export async function updateProfile(payload) {
  return request('/update-profile', { method: 'PUT', auth: true, body: payload })
}

export async function getCouponPackages(query = 'activeOnly=true') {
  return request(`/coupon-packages?${query}`)
}

export async function getTemplates(query = 'page=1&limit=24') {
  return request(`/templates?${query}`)
}

export async function likeTemplate(templateId) {
  return request(`/templates/${templateId}/like`, { method: 'POST', auth: true })
}

export async function createTemplate(payload) {
  return request('/create-template', { method: 'POST', auth: true, body: payload })
}

export async function createPaystackCheckout(payload) {
  return request('/create-paystack-checkout', { method: 'POST', auth: true, body: payload })
}

export async function createCouponCheckout(payload) {
  return request('/create-coupon-checkout', { method: 'POST', auth: true, body: payload })
}

export async function getSignupBonusAvailability() {
  return request('/signup-bonus/availability')
}

export { API_BASE }
