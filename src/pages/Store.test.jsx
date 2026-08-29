import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Store from './Store.jsx'
import { getPaymentSessionStatus, getNotifications } from '../lib/api.js'

// 6.9 (master execution prompt failure-states table): "Payment succeeds,
// CC uncredited" and "Payment fails mid-flow." Paystack fully redirects
// the browser away and back -- React state doesn't survive that round
// trip, and crediting happens asynchronously via the webhook, not on the
// redirect itself. These cover what Store.jsx does after landing back on
// ?reference=...: restore the selected pack from localStorage, poll for
// the credit, and show the right message for each outcome.

const navigateSpy = vi.fn()
let outletContext
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => navigateSpy, useOutletContext: () => outletContext }
})

vi.mock('../lib/api.js', () => ({
  getUserCoupons: vi.fn(async () => ({})),
  getPaymentSessionStatus: vi.fn(),
  getNotifications: vi.fn(async () => ({ notifications: [], unreadCount: 0 })),
  markNotificationRead: vi.fn(),
}))

const refreshBalance = vi.fn(async () => {})
const addToCart = vi.fn()

function renderAt(url) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/store" element={<Store />} />
      </Routes>
    </MemoryRouter>,
  )
}

const PENDING_CHECKOUT_KEY = 'cardora:pendingCheckout'

beforeEach(() => {
  outletContext = {
    balance: 10,
    addToCart,
    currentUser: { id: 'u1', username: 'ada' },
    openAuthModal: vi.fn(),
    couponPackages: [],
    claimDailyCoupon: vi.fn(),
    redeemCodeAction: vi.fn(),
    refreshBalance,
    userCurrency: 'NGN',
    authReady: true,
  }
  vi.mocked(getPaymentSessionStatus).mockReset()
  vi.mocked(getNotifications).mockClear()
  refreshBalance.mockClear()
  navigateSpy.mockClear()
  localStorage.removeItem(PENDING_CHECKOUT_KEY)
})

afterEach(() => {
  localStorage.removeItem(PENDING_CHECKOUT_KEY)
})

describe('Store — 6.9 payment return: no reference', () => {
  it('shows no payment-return banner when the URL has no reference param', () => {
    renderAt('/store')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(getPaymentSessionStatus).not.toHaveBeenCalled()
  })
})

describe('Store — 6.9 payment return: succeeded', () => {
  it('shows the crediting message, refreshes balance, and clears the pending checkout once completed', async () => {
    localStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify({ pack: { id: 'pkg_70', title: '70 CC Pack', amount: '70 CC', price: '₦2,500' }, packageId: 'pkg_70' }))
    vi.mocked(getPaymentSessionStatus).mockResolvedValueOnce({ status: 'completed', packageId: 'pkg_70' })

    renderAt('/store?reference=ref_1')

    await waitFor(() => expect(getPaymentSessionStatus).toHaveBeenCalledWith('ref_1'))
    await waitFor(() => expect(screen.getByText('Payment received — crediting your balance.')).toBeInTheDocument())
    expect(refreshBalance).toHaveBeenCalled()
    expect(localStorage.getItem(PENDING_CHECKOUT_KEY)).toBeNull()
  })

  it('strips the reference param from the URL so a later refresh does not re-trigger it', async () => {
    vi.mocked(getPaymentSessionStatus).mockResolvedValueOnce({ status: 'completed' })
    renderAt('/store?reference=ref_1')

    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/store', { replace: true }))
  })
})

describe('Store — 6.9 payment return: failed', () => {
  it('shows a failure message and restores the pack selection for a clear retry', async () => {
    localStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify({ pack: { id: 'pkg_70', title: '70 CC Pack', amount: '70 CC', price: '₦2,500' }, packageId: 'pkg_70' }))
    vi.mocked(getPaymentSessionStatus).mockResolvedValueOnce({ status: 'failed', failureReason: 'amount_mismatch' })

    renderAt('/store?reference=ref_1')

    await waitFor(() => expect(screen.getByText(/Payment failed\. Your pack is still selected/)).toBeInTheDocument())
    expect(screen.getByText('70 CC Pack')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue to Paystack' })).toBeInTheDocument()
    expect(refreshBalance).not.toHaveBeenCalled()
  })
})

describe('Store — 6.9 payment return: still confirming', () => {
  it('shows the confirming state immediately while the first poll is in flight', async () => {
    vi.mocked(getPaymentSessionStatus).mockImplementation(() => new Promise(() => {}))

    renderAt('/store?reference=ref_1')

    await waitFor(() => expect(screen.getByText('Confirming your payment…')).toBeInTheDocument())
  })

  it('also accepts trxref (Paystack\'s alternate query param)', async () => {
    vi.mocked(getPaymentSessionStatus).mockResolvedValueOnce({ status: 'completed' })
    renderAt('/store?trxref=ref_2')

    await waitFor(() => expect(getPaymentSessionStatus).toHaveBeenCalledWith('ref_2'))
  })
})
