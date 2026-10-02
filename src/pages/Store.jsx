import { useMemo, useState, useEffect, useCallback } from 'react'
import { useOutletContext, useLocation, useNavigate } from 'react-router-dom'
import { IoSparkles } from 'react-icons/io5'
import { TiGift } from 'react-icons/ti'
import { MdHandshake } from 'react-icons/md'
import { HiOutlineFire } from 'react-icons/hi2'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import PackCard from '../components/PackCard.jsx'
import RewardedAds from '../components/RewardedAds.jsx'
import { getUserCoupons, getPaymentSessionStatus } from '../lib/api.js'

const REWARD_TABS = ['earn', 'redeem', 'referral']
const PENDING_CHECKOUT_KEY = 'cardora:pendingCheckout'
// 6.9: Paystack redirects back with the reference under either name
// depending on how the transaction was initialized -- our own
// createPaystackCheckout always includes `reference` in its redirect
// target, but reading both is cheap insurance.
function readReturnedReference(search) {
  const params = new URLSearchParams(search)
  return params.get('reference') || params.get('trxref') || null
}

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
    userCurrency,
    authReady,
  } = useOutletContext()

  const [checkoutMessage, setCheckoutMessage] = useState('')
  const [activePack, setActivePack] = useState(null)
  const [isLaunchingCheckout, setIsLaunchingCheckout] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const queryTab = useMemo(() => {
    const search = new URLSearchParams(location.search)
    return search.get('tab')
  }, [location.search])

  const [activeSection, setActiveSection] = useState('buy')
  // 6.9: "Payment succeeds, CC uncredited" / "Payment fails mid-flow" --
  // idle | confirming | completed | failed | timeout
  const [paymentReturn, setPaymentReturn] = useState({ status: 'idle', message: '', reference: null })

  useEffect(() => {
    if (queryTab && ['buy', 'rewards'].includes(queryTab)) {
      setActiveSection(queryTab)
    }
  }, [queryTab])
  const [activeRewardTab, setActiveRewardTab] = useState('earn')
  const [redeemInput, setRedeemInput] = useState('')
  const [redeemMsg, setRedeemMsg] = useState({ text: '', ok: false })
  const [claimMsg, setClaimMsg] = useState({ text: '', ok: false })
  const [isClaiming, setIsClaiming] = useState(false)
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [copiedField, setCopiedField] = useState('')
  const [streakInfo, setStreakInfo] = useState(null)

  const validPacks = (couponPackages || []).filter(p => (p.cc || 0) > 0)
  const packs = validPacks

  const referralStats = useMemo(
    () => ({
      referralsCount: currentUser?.referralsCount ?? 0,
      referralCode: currentUser?.referralCode || '',
      referralLink: currentUser?.referralCode
        ? `${window.location.origin}/signup?ref=${encodeURIComponent(currentUser.referralCode)}`
        : (currentUser?.referralLink || ''),
    }),
    [currentUser],
  )

  const handleSelect = (pack) => {
    setCheckoutMessage('')
    setActivePack(pack)
  }

  const handleCheckoutStart = async () => {
    if (!activePack) return
    setIsLaunchingCheckout(true)
    setCheckoutMessage('')
    const result = await addToCart(activePack)
    if (!result?.ok) {
      setCheckoutMessage(result?.reason === 'auth' ? 'Please sign in to continue.' : (result?.reason || 'Could not start checkout. Please try again.'))
      setIsLaunchingCheckout(false)
      return
    }
    if (!result.checkout) {
      setIsLaunchingCheckout(false)
      setActivePack(null)
    }
  }

  // 6.9: "Payment succeeds, CC uncredited | Reconciliation per 1.2. Show
  // 'Payment received — crediting your balance'. Alert admin." Crediting
  // happens asynchronously via the Paystack webhook, not on the redirect
  // back here, so this polls rather than assuming the session is already
  // resolved. Returns true once the session has reached a terminal state
  // (completed/failed) so the caller knows whether to keep polling.
  const checkPaymentStatus = useCallback(async (reference) => {
    try {
      const res = await getPaymentSessionStatus(reference)
      const status = res?.status
      if (status === 'completed') {
        setPaymentReturn({ status: 'completed', message: 'Payment received — crediting your balance.', reference })
        await refreshBalance?.()
        try { localStorage.removeItem(PENDING_CHECKOUT_KEY) } catch { /* ignore */ }
        setActivePack(null)
        return true
      }
      if (status === 'failed') {
        // 6.9: "Payment fails mid-flow | Return to store, pack still
        // selected, clear retry." activePack was already restored from
        // localStorage by the effect below -- the existing pack modal's
        // "Continue to Paystack" button IS the clear retry.
        setPaymentReturn({ status: 'failed', message: 'Payment failed. Your pack is still selected — try again below.', reference })
        return true
      }
      return false
    } catch (err) {
      setPaymentReturn({ status: 'failed', message: err.message || 'Could not confirm payment status.', reference })
      return true
    }
  }, [refreshBalance])

  // Detects a return from Paystack (?reference=... or ?trxref=...) once on
  // mount, restores the pack selection React state didn't survive the
  // full-page redirect round trip, and polls for the webhook-driven credit.
  useEffect(() => {
    const reference = readReturnedReference(location.search)
    if (!reference) return undefined

    // Strip the query params immediately so a later refresh of /store
    // doesn't re-trigger this against an already-resolved reference.
    navigate(location.pathname, { replace: true })

    try {
      const pending = JSON.parse(localStorage.getItem(PENDING_CHECKOUT_KEY) || 'null')
      if (pending?.pack) setActivePack(pending.pack)
    } catch { /* ignore */ }

    setPaymentReturn({ status: 'confirming', message: 'Confirming your payment…', reference })

    let cancelled = false
    let attempt = 0
    const maxAttempts = 6
    const poll = async () => {
      if (cancelled) return
      attempt += 1
      const resolved = await checkPaymentStatus(reference)
      if (resolved || cancelled) return
      if (attempt >= maxAttempts) {
        setPaymentReturn({ status: 'timeout', message: 'Still confirming your payment — this can take a minute. We\'ll keep it safe either way.', reference })
        return
      }
      setTimeout(poll, 2000)
    }
    poll()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleClaimDaily = async () => {
    if (!currentUser) {
      openAuthModal()
      return
    }
    setIsClaiming(true)
    setClaimMsg({ text: '', ok: false })
    const result = await claimDailyCoupon()
    setClaimMsg({ text: result.message, ok: result.ok })
    setIsClaiming(false)
    // Refresh streak info after claim
    try {
      const couponData = await getUserCoupons()
      setStreakInfo({
        streak: couponData?.dailyClaimStreak ?? 0,
        reward: couponData?.dailyFreeRewardAmount ?? 1,
        isPremium: couponData?.isPremiumActive ?? false,
        premiumUntil: couponData?.premiumUntil ?? null,
      })
    } catch { /* silent */ }
  }

  const handleRedeem = async () => {
    if (!currentUser) {
      openAuthModal()
      return
    }
    if (!redeemInput.trim()) {
      setRedeemMsg({ text: 'Enter a code.', ok: false })
      return
    }
    setIsRedeeming(true)
    setRedeemMsg({ text: '', ok: false })
    const result = await redeemCodeAction(redeemInput.trim())
    setRedeemMsg({ text: result.message, ok: result.ok })
    if (result.ok) setRedeemInput('')
    setIsRedeeming(false)
  }

  const handleCopy = async (value, field) => {
    if (!value) return
    try {
      await navigator.clipboard?.writeText(value)
      setCopiedField(field)
      setTimeout(() => setCopiedField(''), 1800)
    } catch {
      setCopiedField('')
    }
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
              Add credits, earn more through activity, redeem rewards, and keep an eye on the gift
              lane as it gets ready.
            </p>
          </div>
        </div>

        <div className="tabs store-tabs">
          <button
            type="button"
            className={`tab ${activeSection === 'buy' ? 'active' : ''}`}
            onClick={() => setActiveSection('buy')}
          >
            Buy CC
          </button>
          <button
            type="button"
            className={`tab ${activeSection === 'rewards' ? 'active' : ''}`}
            onClick={() => setActiveSection('rewards')}
          >
            Rewards Hub
          </button>
        </div>

        {checkoutMessage ? <p className="form-error">{checkoutMessage}</p> : null}

        {paymentReturn.status !== 'idle' && (
          <div className={`store-payment-return ${paymentReturn.status}`} role="status">
            <p>{paymentReturn.message}</p>
            {paymentReturn.status === 'timeout' && (
              <button
                type="button"
                className="ghost"
                onClick={() => checkPaymentStatus(paymentReturn.reference)}
              >
                Check again
              </button>
            )}
          </div>
        )}

        {activeSection === 'buy' && (
          <div className="pack-grid">
            {userCurrency && (
              <p className="pack-currency-note">Prices shown in {userCurrency}. Change currency in your profile settings.</p>
            )}
            {!authReady ? (
              <div className="store-frame-empty">Loading store packages...</div>
            ) : packs.length === 0 ? (
              <div className="store-frame-empty">No CC packages are available right now. Please check back shortly.</div>
            ) : (
              packs.map((pack, index) => (
                <PackCard
                  key={pack.id || `${pack.title}-${index}`}
                  {...pack}
                  onSelect={() => handleSelect(pack)}
                />
              ))
            )}
          </div>
        )}

        {activeSection === 'rewards' && (
          <div className="store-rewards-shell">
            <div className="store-reward-tabs">
              <button
                type="button"
                className={`store-reward-tab ${activeRewardTab === 'earn' ? 'active' : ''}`}
                onClick={() => setActiveRewardTab('earn')}
              >
                <span className="store-reward-tab-icon"><IoSparkles size={18} /></span>
                Earn CC
              </button>
              <button
                type="button"
                className={`store-reward-tab ${activeRewardTab === 'redeem' ? 'active' : ''}`}
                onClick={() => setActiveRewardTab('redeem')}
              >
                <span className="store-reward-tab-icon"><TiGift size={18} /></span>
                Redeem
              </button>
              <button
                type="button"
                className={`store-reward-tab ${activeRewardTab === 'referral' ? 'active' : ''}`}
                onClick={() => setActiveRewardTab('referral')}
              >
                <span className="store-reward-tab-icon"><MdHandshake size={18} /></span>
                Referrals
              </button>
            </div>

            {activeRewardTab === 'earn' && (
              <div className="store-earn-section">
                <div className="store-earn-card">
                  <div className="store-earn-badge">
                    <span className="store-earn-badge-icon"><TiGift size={24} /></span>
                  </div>
                  <div className="store-earn-info">
                    <h4>Daily Free Coupon</h4>
                    <p>Claim 1 CC every day.</p>
                    {streakInfo && streakInfo.streak > 0 && (
                      <div className="store-streak-badge">
                        <span className="store-streak-fire"><HiOutlineFire size={16} /></span>
                        <span>{streakInfo.streak}-day streak</span>
                      </div>
                    )}
                    {claimMsg.text && (
                      <p className={`store-earn-msg ${claimMsg.ok ? 'success' : 'error'}`}>{claimMsg.text}</p>
                    )}
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

                <RewardedAds onBalanceUpdate={refreshBalance} />
              </div>
            )}

            {activeRewardTab === 'redeem' && (
              <div className="store-redeem-section">
                <div className="store-redeem-card">
                  <div className="store-redeem-badge">
                    <span><TiGift size={24} /></span>
                  </div>
                  <h4>Redeem a Code</h4>
                  <p>Enter a promo or gift code to add CC to your wallet.</p>
                  <div className="store-redeem-input-wrap">
                    <input
                      type="text"
                      value={redeemInput}
                      onChange={(event) => setRedeemInput(event.target.value)}
                      placeholder="XXXX-XXXX-XXXX"
                      maxLength={30}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') handleRedeem()
                      }}
                    />
                    <button className="primary" type="button" onClick={handleRedeem} disabled={isRedeeming}>
                      {isRedeeming ? '...' : 'Redeem'}
                    </button>
                  </div>
                  {redeemMsg.text && (
                    <p className={`store-earn-msg ${redeemMsg.ok ? 'success' : 'error'}`}>{redeemMsg.text}</p>
                  )}
                </div>
              </div>
            )}

            {activeRewardTab === 'referral' && (
              <div className="store-referral-section">
                <div className="store-referral-card">
                  <div className="store-referral-head">
                    <div>
                      <p className="eyebrow">Referral Program</p>
                      <h4>Share Cardora, earn milestone rewards.</h4>
                    </div>
                    <div className="store-referral-count">
                      <strong>{referralStats.referralsCount}</strong>
                      <span>Referrals</span>
                    </div>
                  </div>

                  <p className="store-referral-copy">
                    Share your code or link, bring new users in, and milestone rewards
                    will show up in your CC income history.
                  </p>

                  <div className="store-referral-grid">
                    <div className="store-referral-item">
                      <span className="store-referral-label">Your Code</span>
                      <strong>{referralStats.referralCode || 'No code yet'}</strong>
                      <button
                        type="button"
                        className="store-inline-copy"
                        onClick={() => handleCopy(referralStats.referralCode, 'code')}
                        disabled={!referralStats.referralCode}
                      >
                        {copiedField === 'code' ? 'Copied!' : 'Copy Code'}
                      </button>
                    </div>
                    <div className="store-referral-item">
                      <span className="store-referral-label">Invite Link</span>
                      <strong className="store-referral-link">{referralStats.referralLink || 'No link available yet'}</strong>
                      <button
                        type="button"
                        className="store-inline-copy"
                        onClick={() => handleCopy(referralStats.referralLink, 'link')}
                        disabled={!referralStats.referralLink}
                      >
                        {copiedField === 'link' ? 'Copied!' : 'Copy Link'}
                      </button>
                    </div>
                  </div>

                  {/* Milestone progress bar */}
                  {(() => {
                    const MILESTONES = [
                      { count: 1,  reward: 5,   label: '1 referral' },
                      { count: 5,  reward: 15,  label: '5 referrals' },
                      { count: 10, reward: 30,  label: '10 referrals' },
                      { count: 25, reward: 75,  label: '25 referrals' },
                      { count: 50, reward: 150, label: '50 referrals' },
                    ]
                    const count = referralStats.referralsCount
                    const lastIdx = MILESTONES.length - 1
                    // Find which segment we're in
                    const nextIdx = MILESTONES.findIndex(m => m.count > count)
                    const prevIdx = nextIdx === -1 ? lastIdx : Math.max(0, nextIdx - 1)
                    const allDone = nextIdx === -1
                    // Fill = equal-spaced segments. Each segment is 1/lastIdx wide.
                    let fillPct
                    if (allDone) {
                      fillPct = 100
                    } else if (nextIdx === 0) {
                      // Before first milestone
                      fillPct = (count / MILESTONES[0].count) * (100 / lastIdx)
                    } else {
                      const segStart = MILESTONES[prevIdx].count
                      const segEnd = MILESTONES[nextIdx].count
                      const withinSeg = (count - segStart) / (segEnd - segStart)
                      fillPct = ((prevIdx + withinSeg) / lastIdx) * 100
                    }

                    return (
                      <div className="store-referral-milestones">
                        <div className="store-referral-milestones-head">
                          <h5>Milestone Progress</h5>
                          <span className="store-referral-unlocked">
                            {MILESTONES.filter(m => count >= m.count).length} / {MILESTONES.length} unlocked
                          </span>
                        </div>
                        <div className="store-referral-track-wrap">
                          <div className="store-referral-track">
                            <div className="store-referral-track-fill" style={{ width: `${Math.min(100, fillPct)}%` }} />
                            {MILESTONES.map((m, i) => {
                              const pos = (i / lastIdx) * 100
                              const unlocked = count >= m.count
                              return (
                                <div
                                  key={m.count}
                                  className={`store-referral-marker ${unlocked ? 'unlocked' : ''}`}
                                  style={{ left: `${pos}%` }}
                                  title={`${m.count} referrals → +${m.reward} CC`}
                                >
                                  <div className="store-referral-marker-dot" />
                                  <span className="store-referral-marker-label">{m.count}</span>
                                  <span className="store-referral-marker-reward">+{m.reward} CC</span>
                                </div>
                              )
                            })}
                          </div>
                          <div className="store-referral-track-hint">
                            {allDone
                              ? 'All milestones unlocked!'
                              : `${count} / ${MILESTONES[nextIdx].count} referrals — next: +${MILESTONES[nextIdx].reward} CC`}
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}
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

            {checkoutMessage ? <p className="form-error">{checkoutMessage}</p> : null}

            <div className="detail-actions">
              <button className="primary" type="button" onClick={handleCheckoutStart} disabled={isLaunchingCheckout}>
                {isLaunchingCheckout ? 'Redirecting...' : 'Continue to Paystack'}
              </button>
              <button className="ghost" type="button" onClick={() => { setActivePack(null); setCheckoutMessage('') }} disabled={isLaunchingCheckout}>
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

