import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import PackCard from '../components/PackCard.jsx'
import RewardedAds from '../components/RewardedAds.jsx'
import { storePacks } from '../data/catalog.js'

const REWARD_TABS = ['earn', 'redeem', 'referral']

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
  } = useOutletContext()

  const [checkoutMessage, setCheckoutMessage] = useState('')
  const [activePack, setActivePack] = useState(null)
  const [isLaunchingCheckout, setIsLaunchingCheckout] = useState(false)
  const [activeSection, setActiveSection] = useState('buy')
  const [activeRewardTab, setActiveRewardTab] = useState('earn')
  const [redeemInput, setRedeemInput] = useState('')
  const [redeemMsg, setRedeemMsg] = useState({ text: '', ok: false })
  const [claimMsg, setClaimMsg] = useState({ text: '', ok: false })
  const [isClaiming, setIsClaiming] = useState(false)
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [copiedField, setCopiedField] = useState('')

  const validPacks = (couponPackages || []).filter(p => (p.cc || 0) > 0)
  const packs = validPacks.length ? validPacks : storePacks
  const referralRewards = (currentUser?.ccIncomeHistory || []).filter(
    (entry) => (entry.type || entry.source) === 'referral_milestone',
  )
  const referralStats = useMemo(
    () => ({
      referralsCount: currentUser?.referralsCount ?? 0,
      referralCode: currentUser?.referralCode || '',
      referralLink: currentUser?.referralLink || '',
    }),
    [currentUser],
  )

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
    if (!currentUser) {
      openAuthModal()
      return
    }
    setIsClaiming(true)
    setClaimMsg({ text: '', ok: false })
    const result = await claimDailyCoupon()
    setClaimMsg({ text: result.message, ok: result.ok })
    setIsClaiming(false)
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
          <button
            type="button"
            className={`tab ${activeSection === 'gifts' ? 'active' : ''}`}
            onClick={() => setActiveSection('gifts')}
          >
            Gifts Coming Soon
          </button>
        </div>

        {checkoutMessage ? <p className="form-error">{checkoutMessage}</p> : null}

        {activeSection === 'buy' && (
          <div className="pack-grid">
            {userCurrency && (
              <p className="pack-currency-note">Prices shown in {userCurrency}. Change currency in your profile settings.</p>
            )}
            {packs.map((pack, index) => (
              <PackCard
                key={pack.id || `${pack.title}-${index}`}
                {...pack}
                onSelect={() => handleSelect(pack)}
              />
            ))}
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
                <span className="store-reward-tab-icon">&#x2728;</span>
                Earn CC
              </button>
              <button
                type="button"
                className={`store-reward-tab ${activeRewardTab === 'redeem' ? 'active' : ''}`}
                onClick={() => setActiveRewardTab('redeem')}
              >
                <span className="store-reward-tab-icon">&#x1F3AB;</span>
                Redeem
              </button>
              <button
                type="button"
                className={`store-reward-tab ${activeRewardTab === 'referral' ? 'active' : ''}`}
                onClick={() => setActiveRewardTab('referral')}
              >
                <span className="store-reward-tab-icon">&#x1F91D;</span>
                Referrals
              </button>
            </div>

            {activeRewardTab === 'earn' && (
              <div className="store-earn-section">
                <div className="store-earn-card">
                  <div className="store-earn-badge">
                    <span className="store-earn-badge-icon">&#x1F381;</span>
                  </div>
                  <div className="store-earn-info">
                    <h4>Daily Free Coupon</h4>
                    <p>Claim one free coupon every day just for being active.</p>
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
                    <span>&#x1F3AB;</span>
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
                      { count: 1,  reward: 5,   label: '1' },
                      { count: 5,  reward: 15,  label: '5' },
                      { count: 10, reward: 30,  label: '10' },
                      { count: 25, reward: 75,  label: '25' },
                      { count: 50, reward: 150, label: '50' },
                    ]
                    const count = referralStats.referralsCount
                    const nextMilestone = MILESTONES.find(m => m.count > count) || MILESTONES[MILESTONES.length - 1]
                    const prevMilestone = [...MILESTONES].reverse().find(m => m.count <= count)
                    const rangeStart = prevMilestone ? prevMilestone.count : 0
                    const rangeEnd = nextMilestone.count
                    const pct = count >= rangeEnd ? 100 : Math.min(((count - rangeStart) / (rangeEnd - rangeStart)) * 100, 100)

                    return (
                      <div className="store-referral-milestones">
                        <div className="store-referral-milestones-head">
                          <h5>Milestone Progress</h5>
                          <span className="store-referral-unlocked">{referralRewards.length} unlocked</span>
                        </div>
                        <div className="store-referral-track-wrap">
                          <div className="store-referral-track">
                            <div className="store-referral-track-fill" style={{ width: `${pct}%` }} />
                            {MILESTONES.map((m) => {
                              const pos = (m.count / MILESTONES[MILESTONES.length - 1].count) * 100
                              const unlocked = count >= m.count
                              return (
                                <div
                                  key={m.count}
                                  className={`store-referral-marker ${unlocked ? 'unlocked' : ''}`}
                                  style={{ left: `${pos}%` }}
                                  title={`${m.count} referrals → +${m.reward} CC`}
                                >
                                  <div className="store-referral-marker-dot" />
                                  <span className="store-referral-marker-label">{m.label}</span>
                                  <span className="store-referral-marker-reward">+{m.reward} CC</span>
                                </div>
                              )
                            })}
                          </div>
                          <div className="store-referral-track-hint">
                            {count >= MILESTONES[MILESTONES.length - 1].count
                              ? 'All milestones unlocked!'
                              : `${count} / ${nextMilestone.count} referrals — next reward: +${nextMilestone.reward} CC`}
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

        {activeSection === 'gifts' && (
          <div className="store-coming-shell">
            <div className="store-coming-card">
              <span className="store-coming-icon">Soon</span>
              <h4>Gift purchases are coming soon.</h4>
              <p>
                The gifting lane is temporarily paused while we complete the technical work behind
                it. CC purchases and rewards are still live while we finish this part of the
                experience.
              </p>
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

