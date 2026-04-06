import { useOutletContext } from 'react-router-dom'
import { useState } from 'react'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import PackCard from '../components/PackCard.jsx'
import RewardedAds from '../components/RewardedAds.jsx'
import { storePacks } from '../data/catalog.js'
import { extractCheckoutUrl } from '../lib/backendMappers.js'

function Store() {
  const {
    balance,
    addToCart,
    currentUser,
    openAuthModal,
    couponPackages,
    claimDailyCoupon,
    redeemCodeAction,
    refreshBalance,
  } = useOutletContext()
  const [checkoutMessage, setCheckoutMessage] = useState('')
  const [activePack, setActivePack] = useState(null)
  const [isLaunchingCheckout, setIsLaunchingCheckout] = useState(false)
  const [activeSection, setActiveSection] = useState('packs') // packs, earn, redeem
  const [redeemInput, setRedeemInput] = useState('')
  const [redeemMsg, setRedeemMsg] = useState({ text: '', ok: false })
  const [claimMsg, setClaimMsg] = useState({ text: '', ok: false })
  const [isClaiming, setIsClaiming] = useState(false)
  const [isRedeeming, setIsRedeeming] = useState(false)
  const packs = couponPackages?.length ? couponPackages : storePacks

  const handleSelect = (pack) => {
    setActivePack(pack)
  }

  const handleCheckoutStart = async () => {
    if (!activePack) return
    setIsLaunchingCheckout(true)
    const result = await addToCart(activePack)
    if (!result?.ok && result?.reason) {
      setCheckoutMessage(result.reason === 'auth' ? 'Please sign in to continue.' : result.reason)
      setTimeout(() => setCheckoutMessage(''), 2200)
    }
    if (!result?.ok) {
      setIsLaunchingCheckout(false)
      return
    }
    if (!result.checkout) {
      setIsLaunchingCheckout(false)
      setActivePack(null)
    }
  }

  const handleClaimDaily = async () => {
    if (!currentUser) { openAuthModal(); return }
    setIsClaiming(true)
    setClaimMsg({ text: '', ok: false })
    const result = await claimDailyCoupon()
    setClaimMsg({ text: result.message, ok: result.ok })
    setIsClaiming(false)
  }

  const handleRedeem = async () => {
    if (!currentUser) { openAuthModal(); return }
    if (!redeemInput.trim()) { setRedeemMsg({ text: 'Enter a code.', ok: false }); return }
    setIsRedeeming(true)
    setRedeemMsg({ text: '', ok: false })
    const result = await redeemCodeAction(redeemInput.trim())
    setRedeemMsg({ text: result.message, ok: result.ok })
    if (result.ok) setRedeemInput('')
    setIsRedeeming(false)
  }

  return (
    <div className="page-body">
      <ScreenHeader user={currentUser} balance={balance} onAuthOpen={openAuthModal} />
      <div className="screen-body">
        <div className="wallet-hero">
          <div className="wallet-copy">
            <p className="eyebrow">Wallet</p>
            <h2 className="wallet-title">Keep your next surprise ready to send.</h2>
            <p className="subtext">
              Add credits, unlock premium templates, and power interactive gifts without
              leaving the experience.
            </p>
          </div>
        </div>

        <div className="tabs store-tabs">
          <button type="button" className={`tab ${activeSection === 'packs' ? 'active' : ''}`} onClick={() => setActiveSection('packs')}>
            Buy CC
          </button>
          <button type="button" className={`tab ${activeSection === 'earn' ? 'active' : ''}`} onClick={() => setActiveSection('earn')}>
            Earn CC
          </button>
          <button type="button" className={`tab ${activeSection === 'redeem' ? 'active' : ''}`} onClick={() => setActiveSection('redeem')}>
            Redeem
          </button>
        </div>

        {checkoutMessage ? <p className="form-error">{checkoutMessage}</p> : null}

        {/* BUY CC TAB */}
        {activeSection === 'packs' && (
          <div className="pack-grid">
            {packs.map((pack, index) => (
              <PackCard
                key={pack.id || `${pack.title}-${index}`}
                {...pack}
                onSelect={() => handleSelect(pack)}
              />
            ))}
          </div>
        )}

        {/* EARN CC TAB */}
        {activeSection === 'earn' && (
          <div className="store-earn-section">
            {/* Daily Free Coupon */}
            <div className="store-earn-card">
              <div className="store-earn-icon">🎁</div>
              <div className="store-earn-info">
                <h4>Daily Free Coupon</h4>
                <p>Claim one free coupon every day just for being active.</p>
                {claimMsg.text && <p className={`store-earn-msg ${claimMsg.ok ? 'success' : 'error'}`}>{claimMsg.text}</p>}
              </div>
              <button
                className="primary store-earn-btn"
                type="button"
                onClick={handleClaimDaily}
                disabled={isClaiming}
              >
                {isClaiming ? 'Claiming...' : 'Claim Now'}
              </button>
            </div>

            {/* Rewarded Ads */}
            <RewardedAds onBalanceUpdate={refreshBalance} />
          </div>
        )}

        {/* REDEEM TAB */}
        {activeSection === 'redeem' && (
          <div className="store-redeem-section">
            <div className="store-redeem-card">
              <span className="store-redeem-icon">🎫</span>
              <h4>Redeem a Code</h4>
              <p>Enter a promo code or gift code to add CC to your balance.</p>
              <div className="store-redeem-input-wrap">
                <input
                  type="text"
                  value={redeemInput}
                  onChange={(e) => setRedeemInput(e.target.value)}
                  placeholder="Enter code..."
                  maxLength={30}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRedeem() }}
                />
                <button
                  className="primary"
                  type="button"
                  onClick={handleRedeem}
                  disabled={isRedeeming}
                >
                  {isRedeeming ? '...' : 'Redeem'}
                </button>
              </div>
              {redeemMsg.text && <p className={`store-earn-msg ${redeemMsg.ok ? 'success' : 'error'}`}>{redeemMsg.text}</p>}
            </div>
          </div>
        )}
      </div>
      <ScreenNav />

      {activePack ? (
        <section className="detail-modal" role="dialog" aria-modal="true">
          <div className="detail-backdrop" onClick={() => setActivePack(null)} />
          <div className="detail-card store-pay-modal">
            <div className="store-pay-hero">
              <p className="eyebrow">CC Payment</p>
              <h3>Confirm your credit purchase</h3>
              <p className="detail-subtitle">
                You're about to continue to secure payment for this CC package.
              </p>
            </div>

            <div className="store-pay-summary">
              <div className="store-pay-row">
                <span>Package</span>
                <strong>{activePack.title}</strong>
              </div>
              <div className="store-pay-row">
                <span>Credits</span>
                <strong>{activePack.amount}</strong>
              </div>
              <div className="store-pay-row">
                <span>Price</span>
                <strong>{activePack.price}</strong>
              </div>
              {activePack.bonus ? (
                <div className="store-pay-row">
                  <span>Bonus</span>
                  <strong>{activePack.bonus}</strong>
                </div>
              ) : null}
            </div>

            <div className="detail-actions">
              <button className="primary" type="button" onClick={handleCheckoutStart} disabled={isLaunchingCheckout}>
                {isLaunchingCheckout ? 'Redirecting...' : 'Continue to Paystack'}
              </button>
              <button className="ghost" type="button" onClick={() => setActivePack(null)} disabled={isLaunchingCheckout}>
                Cancel
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}

export default Store
