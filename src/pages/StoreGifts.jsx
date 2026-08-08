import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import PremiumGiftReveal from '../components/PremiumGiftReveal.jsx'
import GiftPreviewModal from '../components/GiftPreviewModal.jsx'
import { GiftIcon } from '../components/GiftCard.jsx'
import { MdCardGiftcard, MdInventory } from 'react-icons/md'
import { storeGifts } from '../data/catalog.js'
import { getGiftCatalog, createFlutterwaveGiftCheckout, verifyGiftPayment } from '../lib/api.js'
import { normalizeCheckoutSession } from '../lib/backendMappers.js'
import { formatGiftName as formatGiftLabel, normalizeGiftInventory, rememberConfirmedGift } from '../lib/gifts.js'

const PENDING_GIFT_KEY = 'cardora:pendingGiftCheckout'

const FALLBACK_CATALOG = [
  { name: 'spark', price: 500 },
  { name: 'sweetHeart', price: 1000 },
  { name: 'purpleLove', price: 2000 },
  { name: 'oceanHeart', price: 3000 },
  { name: 'emeraldHeart', price: 5000 },
  { name: 'passionHeart', price: 10000 },
  { name: 'goldenHeart', price: 20000 },
  { name: 'crystalHeart', price: 50000 },
  { name: 'diamondHeart', price: 100000 },
  { name: 'legendaryHeart', price: 200000 },
]

const GIFT_NAME_ALIASES = {
  spark: ['spark', 'tiny', 'tinyHeart', 'Tiny Heart'],
  sweetHeart: ['sweetHeart', 'sweet', 'Sweet Heart'],
  purpleLove: ['purpleLove', 'purple', 'Purple Love'],
  oceanHeart: ['oceanHeart', 'ocean', 'Ocean Heart'],
  emeraldHeart: ['emeraldHeart', 'emerald', 'Emerald Heart'],
  passionHeart: ['passionHeart', 'passion', 'Passion Heart'],
  goldenHeart: ['goldenHeart', 'golden', 'Golden Heart'],
  crystalHeart: ['crystalHeart', 'crystal', 'Crystal Heart'],
  diamondHeart: ['diamondHeart', 'diamond', 'Diamond Heart'],
  legendaryHeart: ['legendaryHeart', 'legendary', 'Legendary Heart'],
}

function formatNgn(amount) {
  return '₦' + Number(amount || 0).toLocaleString()
}

function catalogItemsFromResponse(res) {
  const raw = res?.gifts || res?.data?.gifts || res?.prices || res?.catalog || res?.data?.prices || res?.data || []
  if (Array.isArray(raw)) {
    return raw
      .map(item => {
        const price = item.priceNgn ?? item.price ?? item.amount ?? item.valueNgn
        return {
          name: item.name || item.giftName || item.id,
          price,
          // Backend computes the marked-up charge amount; fall back to the same
          // 10% math client-side only if the field is missing (older backend).
          chargeAmount: item.chargeAmountNgn ?? Math.round(Number(price || 0) * 1.1),
          effectKey: item.effectKey || '',
          color: item.color || '',
          tier: item.tier || '',
        }
      })
      .filter(item => item.name)
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([name, price]) => {
      const resolvedPrice = typeof price === 'object' ? (price.priceNgn || price.price || price.amount) : price
      return {
        name,
        price: resolvedPrice,
        chargeAmount: (typeof price === 'object' && price.chargeAmountNgn) || Math.round(Number(resolvedPrice || 0) * 1.1),
      }
    })
  }
  return []
}

function getStoredPendingGift() {
  try {
    const raw = sessionStorage.getItem(PENDING_GIFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function storePendingGift(gift, checkout = {}) {
  try {
    sessionStorage.setItem(PENDING_GIFT_KEY, JSON.stringify({
      name: gift.name,
      price: gift.price,
      reference: checkout.reference || '',
      savedAt: Date.now(),
    }))
  } catch { /* ignore */ }
}

function clearPendingGift() {
  try {
    sessionStorage.removeItem(PENDING_GIFT_KEY)
  } catch { /* ignore */ }
}

function StoreGifts() {
  const { currentUser, openAuthModal, balance, refreshBalance, inventory: appInventory = [] } = useOutletContext()
  const location = useLocation()
  const navigate = useNavigate()
  const [catalog, setCatalog] = useState([])
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [buying, setBuying] = useState(null)
  const [confirmGift, setConfirmGift] = useState(null)
  const [activeGift, setActiveGift] = useState(null)
  const [msg, setMsg] = useState({ text: '', ok: false })
  const [activeView, setActiveView] = useState('catalog')
  const [revealingGift, setRevealingGift] = useState(null)
  const [returnRefreshing, setReturnRefreshing] = useState(false)

  const inventory = appInventory.length ? appInventory : normalizeGiftInventory(currentUser?.giftsInventory || [], true)
  const walletBalance = currentUser?.giftWalletNgn || 0
  // Artists design/publish templates rather than send real gifts — the
  // consumer purchase flow here doesn't apply to their account type.
  const isArtist = String(currentUser?.role || '').toLowerCase() === 'artist'

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await getGiftCatalog()
        const items = catalogItemsFromResponse(res)
        if (!cancelled) setCatalog(items.length > 0 ? items : FALLBACK_CATALOG)
      } catch {
        if (!cancelled) setCatalog(FALLBACK_CATALOG)
      } finally {
        if (!cancelled) setLoadingCatalog(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const isGiftReturn =
      params.get('gift') === 'callback' ||
      params.has('tx_ref') ||
      params.has('transaction_id') ||
      params.has('status')
    if (!isGiftReturn) return

    const pending = getStoredPendingGift()
    const returnedName = params.get('giftName') || pending?.name || ''
    const returnedGift = returnedName ? { ...(pending || {}), name: returnedName } : pending
    let cancelled = false

    ;(async () => {
      setReturnRefreshing(true)
      setMsg({ text: 'Payment received. Verifying your gift purchase...', ok: true })

      // Call verify-payment to immediately credit the gift to inventory.
      // The webhook is just a delayed fallback — this is the primary path.
      const txRef = params.get('tx_ref') || params.get('txRef') || ''
      const transactionId = params.get('transaction_id') || params.get('transactionId') || ''
      let verified = false
      if (transactionId || txRef) {
        try {
          await verifyGiftPayment({ transaction_id: transactionId, tx_ref: txRef })
          verified = true
          // Payment verified — clear the pending placeholder so hydrateSession
          // doesn't keep injecting an 'unverified' ghost item.
          clearPendingGift()
          rememberConfirmedGift(currentUser?.id || currentUser?._id || currentUser?.email, returnedGift)
          setMsg({ text: 'Payment verified! Refreshing your inventory...', ok: true })
        } catch (verifyErr) {
          console.warn('[StoreGifts] verify-payment failed, falling back to webhook:', verifyErr.message)
          setMsg({ text: 'Verifying payment... this may take a moment.', ok: true })
        }
      }

      // Refresh session to pick up the newly credited gift — and actually
      // check it landed before declaring success. This used to show "Gift
      // added" unconditionally after the retry loop regardless of whether
      // verifyGiftPayment succeeded or the gift ever appeared in inventory.
      let landedGift = false
      const giftKey = (returnedGift?.name || '').trim().toLowerCase()
      for (const delay of [500, 1500, 3000]) {
        await new Promise(resolve => setTimeout(resolve, delay))
        if (cancelled) return
        const updatedUser = await refreshBalance?.()
        const inv = Array.isArray(updatedUser?.giftsInventory) ? updatedUser.giftsInventory : []
        if (giftKey && inv.some(g => (g.giftName || g.name || '').trim().toLowerCase() === giftKey)) {
          landedGift = true
          break
        }
      }
      if (cancelled) return
      setActiveView('inventory')
      if (landedGift) {
        if (returnedGift?.name) setRevealingGift(returnedGift)
        setMsg({ text: 'Gift added. Your inventory has been refreshed.', ok: true })
      } else if (verified) {
        setMsg({ text: 'Payment verified, but your inventory hasn\'t updated yet — check back in a moment or refresh.', ok: true })
      } else {
        setMsg({ text: 'We couldn\'t confirm your gift purchase yet. If you were charged, it will appear here shortly once the payment is verified.', ok: false })
      }
      setReturnRefreshing(false)
      navigate('/store/gifts', { replace: true })
    })()

    return () => { cancelled = true }
  }, [location.search, navigate, refreshBalance])

  const handleBuyGift = async (gift) => {
    if (!currentUser) { openAuthModal(); return }
    if (isArtist) { setMsg({ text: 'Artist accounts publish templates to the marketplace and can\'t purchase gifts.', ok: false }); return }
    setBuying(gift.name)
    setMsg({ text: '', ok: false })
    try {
      let res = null
      let lastGiftError = null
      const names = [...new Set([...(GIFT_NAME_ALIASES[gift.name] || []), gift.name].filter(Boolean))]
      for (const giftName of names) {
        try {
          const callbackUrl = `${window.location.origin}/store/gifts?gift=callback&giftName=${encodeURIComponent(gift.name)}`
          res = await createFlutterwaveGiftCheckout({
            giftName,
            callbackUrl,
            callback_url: callbackUrl,
            redirectUrl: callbackUrl,
            redirect_url: callbackUrl,
            returnUrl: callbackUrl,
          })
          break
        } catch (error) {
          lastGiftError = error
          const canTryNext =
            [400, 404].includes(error?.status) &&
            /gift/i.test(error?.message || '')
          if (!canTryNext) throw error
        }
      }
      if (!res && lastGiftError) throw lastGiftError
      const checkout = normalizeCheckoutSession(res)
      if (checkout.checkoutUrl) {
        storePendingGift(gift, checkout)
        window.location.href = checkout.checkoutUrl
      } else {
        rememberConfirmedGift(currentUser?.id || currentUser?._id || currentUser?.email, gift)
        setMsg({ text: checkout.message || 'Gift added to inventory!', ok: true })
        await refreshBalance?.()
        setActiveView('inventory')
        setRevealingGift(gift)
        setConfirmGift(null)
        setTimeout(() => setMsg({ text: '', ok: false }), 3500)
      }
    } catch (err) {
      // Keep the confirm modal open on failure — the error is rendered inside
      // it — instead of closing it and leaving the message to flash
      // somewhere on the page body behind nothing the user is looking at.
      setMsg({ text: err?.message || 'Purchase failed. Please try again.', ok: false })
    } finally {
      setBuying(null)
    }
  }

  const formatGiftName = formatGiftLabel

  return (
    <div className="page-body">
      <ScreenHeader user={currentUser} balance={balance} onAuthOpen={openAuthModal} />
      <div className="screen-body">
        <div className="tabs store-tabs">
          <button
            type="button"
            className="tab"
            onClick={() => navigate('/store?tab=buy')}
          >
            Buy CC
          </button>
          <button
            type="button"
            className="tab"
            onClick={() => navigate('/store?tab=cosmetics')}
          >
            Cosmetics
          </button>
          <button
            type="button"
            className="tab"
            onClick={() => navigate('/store?tab=rewards')}
          >
            Rewards Hub
          </button>
          <button
            type="button"
            className="tab active"
            onClick={() => navigate('/store/gifts')}
          >
            Gifts
          </button>
        </div>

        {/* Catalog & Inventory Toggle buttons */}
        <div style={{
          display: 'flex', gap: 8, justifyContent: 'center', margin: '20px 0',
        }}>
          <button
            type="button"
            onClick={() => setActiveView('catalog')}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: activeView === 'catalog' ? 'var(--btn-bg-hover)' : 'var(--inset)',
              color: activeView === 'catalog' ? 'var(--primary)' : 'var(--text-muted)',
              fontSize: 13, fontWeight: 600,
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            <MdCardGiftcard size={16} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} /> Catalog
          </button>
          <button
            type="button"
            onClick={() => setActiveView('inventory')}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: activeView === 'inventory' ? 'var(--btn-bg-hover)' : 'var(--inset)',
              color: activeView === 'inventory' ? 'var(--primary)' : 'var(--text-muted)',
              fontSize: 13, fontWeight: 600,
              transition: 'background 0.2s, color 0.2s',
              position: 'relative',
            }}
          >
            <MdInventory size={16} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} /> Inventory
            {inventory.length > 0 && (
              <span style={{
                position: 'absolute', top: -6, right: -6,
                background: '#1dd1a1', color: '#fff', borderRadius: '50%',
                width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
              }}>{inventory.length}</span>
            )}
          </button>
        </div>

        {msg.text && (
          <p style={{
            padding: '10px 16px', borderRadius: 10, margin: '0 0 16px', fontSize: 13, fontWeight: 500,
            background: msg.ok ? 'var(--accent-soft)' : 'rgba(220, 38, 38, 0.08)',
            color: msg.ok ? 'var(--success)' : 'var(--danger)',
            border: `1px solid ${msg.ok ? 'var(--hairline)' : 'rgba(220, 38, 38, 0.2)'}`,
          }}>{msg.text}</p>
        )}

        {activeView === 'catalog' && (
          <>
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ color: 'var(--text)', margin: '0 0 4px', fontSize: 16 }}>Send a Gift with Your Card</h4>
              <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 13 }}>
                Buy a gift, attach it to your personal card in Studio. Recipients receive 100% of the gift value — a 10% platform fee is added at checkout.
              </p>
            </div>

            {isArtist && (
              <p style={{
                margin: '0 0 16px', padding: '10px 14px', borderRadius: 10,
                background: 'rgba(217, 119, 6, 0.08)', border: '1px solid rgba(217, 119, 6, 0.15)',
                color: 'var(--warning)', fontSize: 13,
              }}>
                Artist accounts design and publish templates to the marketplace and can't purchase gifts from the Store.
              </p>
            )}

            {loadingCatalog ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>
                <div className="chat-loading-spinner" />
                <p>Loading gift catalog...</p>
              </div>
            ) : (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 14,
              }}>
                {catalog.map((gift) => {
                  const legacyKey = gift.effectKey || GIFT_NAME_ALIASES[gift.name]?.[1] || gift.name
                  const staticItem = storeGifts.find(sg => sg.effectKey === legacyKey) || {}
                  const resolvedGift = {
                    name: gift.name,
                    price: gift.price,
                    chargeAmount: gift.chargeAmount,
                    title: formatGiftName(gift.name),
                    effectKey: legacyKey,
                    color: gift.color || staticItem.color || '',
                    tier: gift.tier || staticItem.tier || '',
                    note: staticItem.note || `A premium ${formatGiftName(gift.name)} gift.`,
                  }
                  return (
                    <div
                      key={gift.name}
                      role="button"
                      tabIndex={0}
                      aria-label={`Preview ${resolvedGift.title}`}
                      onClick={() => setActiveGift(resolvedGift)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setActiveGift(resolvedGift)
                        }
                      }}
                      style={{
                        background: 'var(--surface)',
                        borderRadius: 14, padding: 16,
                        border: '1px solid var(--border)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                        transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-4px)'
                        e.currentTarget.style.borderColor = 'var(--primary)'
                        e.currentTarget.style.boxShadow = 'var(--shadow-md)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = ''
                        e.currentTarget.style.borderColor = 'var(--border)'
                        e.currentTarget.style.boxShadow = ''
                      }}
                    >
                      <div style={{
                        width: 56, height: 56,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <GiftIcon effectKey={legacyKey} size={56} />
                      </div>
                      <strong style={{ color: 'var(--text)', fontSize: 13, textAlign: 'center' }}>
                        {resolvedGift.title}
                      </strong>
                      <span style={{
                        color: 'var(--success)', fontSize: 15, fontWeight: 700,
                      }}>
                        {formatNgn(gift.price)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveGift(resolvedGift)
                        }}
                        style={{
                          width: '100%', padding: '8px 0', borderRadius: 8,
                          border: 'none', cursor: 'pointer',
                          background: 'var(--btn-primary-bg)',
                          color: 'var(--btn-primary-text)', fontSize: 13, fontWeight: 600,
                          transition: 'opacity 0.2s',
                        }}
                      >
                        Preview
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {activeView === 'inventory' && (
          <>
            <h4 style={{ color: 'var(--text)', margin: '0 0 12px', fontSize: 16 }}>Your Gift Inventory</h4>
            {inventory.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '40px 20px',
                background: 'var(--surface)', borderRadius: 14,
                border: '1px solid var(--border)',
              }}>
                <MdInventory size={40} style={{ display: 'block', marginBottom: 12, margin: '0 auto', color: 'var(--text-muted)' }} />
                <p style={{ color: 'var(--text-dim)', margin: 0, fontSize: 14 }}>
                  No gifts yet. Buy a gift from the catalog to get started!
                </p>
                <button
                  type="button"
                  onClick={() => setActiveView('catalog')}
                  style={{
                    marginTop: 16, padding: '10px 24px', borderRadius: 8,
                    background: 'var(--btn-primary-bg)',
                    color: 'var(--btn-primary-text)', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  }}
                >
                  Browse Catalog
                </button>
              </div>
            ) : (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 12,
              }}>
                {inventory.map((item, idx) => {
                  const giftName = item.giftName || item.name || 'spark'
                  const legacyKey = item.effectKey || GIFT_NAME_ALIASES[giftName]?.[1] || giftName
                  return (
                    <div
                      key={item.id || item.inventoryId || item._id || idx}
                      style={{
                        background: 'var(--surface)',
                        borderRadius: 14, padding: 16,
                        border: '1px solid var(--border)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      }}
                    >
                      <div style={{
                        width: 48, height: 48,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <GiftIcon effectKey={legacyKey} size={48} />
                      </div>
                      <strong style={{ color: 'var(--text)', fontSize: 13, textAlign: 'center' }}>
                        {formatGiftName(giftName)}
                      </strong>
                      {item.amount && (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                          {item.amount}
                        </span>
                      )}
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 6,
                        background: item.status === 'available'
                          ? 'var(--accent-soft)' : 'rgba(217, 119, 6, 0.08)',
                        color: item.status === 'available' ? 'var(--success)' : 'var(--warning)',
                        border: `1px solid ${item.status === 'available' ? 'var(--hairline)' : 'rgba(217, 119, 6, 0.15)'}`,
                        fontWeight: 600, textTransform: 'capitalize',
                      }}>
                        {item.status || 'available'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
      <ScreenNav />

      {activeGift && (
        <GiftPreviewModal
          gift={activeGift}
          disabled={buying === activeGift.name}
          onClose={() => setActiveGift(null)}
          onBuy={() => {
            if (!currentUser) { openAuthModal(); return }
            setConfirmGift(activeGift)
            setActiveGift(null)
          }}
        />
      )}

      {confirmGift && (
        <section className="detail-modal" role="dialog" aria-modal="true">
          <div className="detail-backdrop" onClick={() => { if (buying) return; setConfirmGift(null); setMsg({ text: '', ok: false }) }} />
          <div className="detail-card store-pay-modal">
            <div className="store-pay-hero">
              <p className="eyebrow">Gift checkout</p>
              <h3>Confirm gift purchase</h3>
              <p className="detail-subtitle">
                You will be redirected to Flutterwave to complete payment before this gift is added.
              </p>
            </div>
            <div className="store-pay-summary">
              <div className="store-pay-row">
                <span>Gift</span>
                <strong>{formatGiftName(confirmGift.name)}</strong>
              </div>
              <div className="store-pay-row">
                <span>Gift value</span>
                <strong>{formatNgn(confirmGift.price)}</strong>
              </div>
              <div className="store-pay-row store-pay-row-fee">
                <span>Platform fee (10%)</span>
                <strong>+{formatNgn(Math.max(0, (confirmGift.chargeAmount ?? confirmGift.price) - confirmGift.price))}</strong>
              </div>
              <div className="store-pay-row store-pay-row-total">
                <span>You'll be charged</span>
                <strong>{formatNgn(confirmGift.chargeAmount ?? confirmGift.price)}</strong>
              </div>
            </div>
            <p className="store-pay-fee-note">
              Recipients always receive the full gift value — the 10% platform fee is added here at checkout.
            </p>
            {msg.text && !msg.ok && (
              <p className="form-error">{msg.text}</p>
            )}
            <div className="detail-actions">
              <button
                className="primary"
                type="button"
                onClick={() => handleBuyGift(confirmGift)}
                disabled={buying === confirmGift.name}
              >
                {buying === confirmGift.name ? 'Redirecting...' : 'Continue to Flutterwave'}
              </button>
              <button className="ghost" type="button" onClick={() => { setConfirmGift(null); setMsg({ text: '', ok: false }) }} disabled={buying === confirmGift.name}>
                Cancel
              </button>
            </div>
          </div>
        </section>
      )}

      {revealingGift && (
        <PremiumGiftReveal
          effect={GIFT_NAME_ALIASES[revealingGift.name]?.[1] || revealingGift.name}
          onComplete={() => setRevealingGift(null)}
        />
      )}
    </div>
  )
}

export default StoreGifts
