import { useState, useEffect } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import { getGiftCatalog, createFlutterwaveGiftCheckout } from '../lib/api.js'
import { normalizeCheckoutSession } from '../lib/backendMappers.js'

const GIFT_META = {
  spark:          { emoji: '💫', gradient: 'linear-gradient(135deg, #fbbf24, #f59e0b)' },
  sweetHeart:     { emoji: '💝', gradient: 'linear-gradient(135deg, #f472b6, #ec4899)' },
  purpleLove:     { emoji: '💜', gradient: 'linear-gradient(135deg, #a78bfa, #8b5cf6)' },
  oceanHeart:     { emoji: '🌊', gradient: 'linear-gradient(135deg, #38bdf8, #0284c7)' },
  emeraldHeart:   { emoji: '💚', gradient: 'linear-gradient(135deg, #34d399, #059669)' },
  passionHeart:   { emoji: '❤️‍🔥', gradient: 'linear-gradient(135deg, #fb7185, #e11d48)' },
  goldenHeart:    { emoji: '✨', gradient: 'linear-gradient(135deg, #fde68a, #d97706)' },
  crystalHeart:   { emoji: '💎', gradient: 'linear-gradient(135deg, #67e8f9, #06b6d4)' },
  diamondHeart:   { emoji: '💠', gradient: 'linear-gradient(135deg, #c4b5fd, #7c3aed)' },
  legendaryHeart: { emoji: '🏆', gradient: 'linear-gradient(135deg, #fcd34d, #b45309)' },
}

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

function StoreGifts() {
  const { currentUser, openAuthModal, balance, refreshBalance } = useOutletContext()
  const [catalog, setCatalog] = useState([])
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [buying, setBuying] = useState(null)
  const [confirmGift, setConfirmGift] = useState(null)
  const [msg, setMsg] = useState({ text: '', ok: false })
  const [activeView, setActiveView] = useState('catalog')

  const inventory = currentUser?.giftsInventory || []
  const walletBalance = currentUser?.giftWalletNgn || 0

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await getGiftCatalog()
        const prices = res?.prices || res?.catalog || res?.gifts || res?.data?.prices || res?.data || {}
        const items = Object.entries(prices).map(([name, price]) => ({
          name,
          price: typeof price === 'object' ? price.priceNgn || price.price : price,
        }))
        if (!cancelled && items.length > 0) setCatalog(items)
        else if (!cancelled) {
          // Fallback to static defaults
          setCatalog([
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
          ])
        }
      } catch {
        if (!cancelled) {
          setCatalog([
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
          ])
        }
      } finally {
        if (!cancelled) setLoadingCatalog(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const handleBuyGift = async (gift) => {
    if (!currentUser) { openAuthModal(); return }
    setBuying(gift.name)
    setMsg({ text: '', ok: false })
    try {
      let res = null
      let lastGiftError = null
      const names = [...new Set([...(GIFT_NAME_ALIASES[gift.name] || []), gift.name].filter(Boolean))]
      for (const giftName of names) {
        try {
          res = await createFlutterwaveGiftCheckout({ giftName })
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
        window.location.href = checkout.checkoutUrl
      } else {
        setMsg({ text: checkout.message || 'Gift added to inventory!', ok: true })
        await refreshBalance?.()
      }
    } catch (err) {
      setMsg({ text: err?.message || 'Purchase failed. Please try again.', ok: false })
    } finally {
      setBuying(null)
      setConfirmGift(null)
      setTimeout(() => setMsg({ text: '', ok: false }), 3500)
    }
  }

  const formatGiftName = (name) => {
    return name.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()
  }

  return (
    <div className="page-body">
      <ScreenHeader user={currentUser} balance={balance} onAuthOpen={openAuthModal} />
      <div className="screen-body">
        <div className="tabs">
          <Link className="tab" to="/store">Get CC</Link>
          <span className="tab active">Gift Store</span>
        </div>

        {/* Wallet Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)',
          borderRadius: 16, padding: '20px 24px', margin: '0 0 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          border: '1px solid rgba(139, 92, 246, 0.3)',
        }}>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, margin: 0 }}>Gift Wallet</p>
            <h3 style={{ color: '#fff', margin: '4px 0 0', fontSize: 24, fontWeight: 700 }}>
              {formatNgn(walletBalance)}
            </h3>
          </div>
          <div style={{
            display: 'flex', gap: 8,
          }}>
            <button
              type="button"
              onClick={() => setActiveView('catalog')}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: activeView === 'catalog' ? 'rgba(139, 92, 246, 0.4)' : 'rgba(255,255,255,0.08)',
                color: '#fff', fontSize: 13, fontWeight: 600,
                transition: 'background 0.2s',
              }}
            >
              🎁 Catalog
            </button>
            <button
              type="button"
              onClick={() => setActiveView('inventory')}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: activeView === 'inventory' ? 'rgba(139, 92, 246, 0.4)' : 'rgba(255,255,255,0.08)',
                color: '#fff', fontSize: 13, fontWeight: 600,
                transition: 'background 0.2s',
                position: 'relative',
              }}
            >
              📦 Inventory
              {inventory.length > 0 && (
                <span style={{
                  position: 'absolute', top: -6, right: -6,
                  background: '#8b5cf6', color: '#fff', borderRadius: '50%',
                  width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                }}>{inventory.length}</span>
              )}
            </button>
          </div>
        </div>

        {msg.text && (
          <p style={{
            padding: '10px 16px', borderRadius: 10, margin: '0 0 16px', fontSize: 13, fontWeight: 500,
            background: msg.ok ? 'rgba(52, 211, 153, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: msg.ok ? '#6ee7b7' : '#fca5a5',
            border: `1px solid ${msg.ok ? 'rgba(52, 211, 153, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
          }}>{msg.text}</p>
        )}

        {activeView === 'catalog' && (
          <>
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ color: '#fff', margin: '0 0 4px', fontSize: 16 }}>Send a Gift with Your Card</h4>
              <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0, fontSize: 13 }}>
                Buy a gift, attach it to your personal card in Studio. Recipients receive 90% of the gift value.
              </p>
            </div>

            {loadingCatalog ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.4)' }}>
                <div className="chat-loading-spinner" />
                <p>Loading gift catalog...</p>
              </div>
            ) : (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 14,
              }}>
                {catalog.map((gift) => {
                  const meta = GIFT_META[gift.name] || { emoji: '🎁', gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }
                  return (
                    <div
                      key={gift.name}
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        borderRadius: 14, padding: 16,
                        border: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                        transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-4px)'
                        e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)'
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(139, 92, 246, 0.15)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = ''
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                        e.currentTarget.style.boxShadow = ''
                      }}
                    >
                      <div style={{
                        width: 56, height: 56, borderRadius: '50%',
                        background: meta.gradient,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 26, boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                      }}>
                        {meta.emoji}
                      </div>
                      <strong style={{ color: '#fff', fontSize: 13, textAlign: 'center' }}>
                        {formatGiftName(gift.name)}
                      </strong>
                      <span style={{
                        color: '#a78bfa', fontSize: 15, fontWeight: 700,
                      }}>
                        {formatNgn(gift.price)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (!currentUser) { openAuthModal(); return }
                          setConfirmGift(gift)
                        }}
                        disabled={buying === gift.name}
                        style={{
                          width: '100%', padding: '8px 0', borderRadius: 8,
                          border: 'none', cursor: buying === gift.name ? 'wait' : 'pointer',
                          background: buying === gift.name ? 'rgba(139, 92, 246, 0.3)' : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                          color: '#fff', fontSize: 13, fontWeight: 600,
                          transition: 'opacity 0.2s',
                          opacity: buying === gift.name ? 0.7 : 1,
                        }}
                      >
                        {buying === gift.name ? 'Processing...' : 'Buy Gift'}
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
            <h4 style={{ color: '#fff', margin: '0 0 12px', fontSize: 16 }}>Your Gift Inventory</h4>
            {inventory.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '40px 20px',
                background: 'rgba(255,255,255,0.03)', borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <span style={{ fontSize: 40, display: 'block', marginBottom: 12 }}>📦</span>
                <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0, fontSize: 14 }}>
                  No gifts yet. Buy a gift from the catalog to get started!
                </p>
                <button
                  type="button"
                  onClick={() => setActiveView('catalog')}
                  style={{
                    marginTop: 16, padding: '10px 24px', borderRadius: 8,
                    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                    color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
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
                  const meta = GIFT_META[item.giftName || item.name] || { emoji: '🎁', gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }
                  return (
                    <div
                      key={item.inventoryId || item._id || idx}
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        borderRadius: 14, padding: 16,
                        border: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      }}
                    >
                      <div style={{
                        width: 48, height: 48, borderRadius: '50%',
                        background: meta.gradient,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 22,
                      }}>
                        {meta.emoji}
                      </div>
                      <strong style={{ color: '#fff', fontSize: 13, textAlign: 'center' }}>
                        {formatGiftName(item.giftName || item.name || 'Gift')}
                      </strong>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 6,
                        background: item.status === 'available'
                          ? 'rgba(52, 211, 153, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                        color: item.status === 'available' ? '#6ee7b7' : '#fcd34d',
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

      {confirmGift && (
        <section className="detail-modal" role="dialog" aria-modal="true">
          <div className="detail-backdrop" onClick={() => buying ? null : setConfirmGift(null)} />
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
                <span>Price</span>
                <strong>{formatNgn(confirmGift.price)}</strong>
              </div>
            </div>
            <div className="detail-actions">
              <button
                className="primary"
                type="button"
                onClick={() => handleBuyGift(confirmGift)}
                disabled={buying === confirmGift.name}
              >
                {buying === confirmGift.name ? 'Redirecting...' : 'Continue to Flutterwave'}
              </button>
              <button className="ghost" type="button" onClick={() => setConfirmGift(null)} disabled={buying === confirmGift.name}>
                Cancel
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

export default StoreGifts
