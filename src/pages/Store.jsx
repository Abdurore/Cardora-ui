import { useCallback, useMemo, useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import PackCard from '../components/PackCard.jsx'
import RewardedAds from '../components/RewardedAds.jsx'
import { storePacks, storeGifts } from '../data/catalog.js'
import GiftCard from '../components/GiftCard.jsx'
import GiftPreviewModal from '../components/GiftPreviewModal.jsx'
import { buyChatFrame, equipChatFrame, getUserCoupons, getChatFrames, getCachedChatFrames } from '../lib/api.js'

const REWARD_TABS = ['earn', 'redeem', 'referral']

function pickList(res, ...keys) {
  for (const key of keys) {
    if (Array.isArray(res?.[key])) return res[key]
    if (Array.isArray(res?.data?.[key])) return res.data[key]
    if (Array.isArray(res?.data?.[key]?.docs)) return res.data[key].docs
    if (Array.isArray(res?.data?.[key]?.items)) return res.data[key].items
    if (Array.isArray(res?.result?.[key])) return res.result[key]
  }
  if (Array.isArray(res?.data)) return res.data
  if (Array.isArray(res?.results)) return res.results
  if (Array.isArray(res)) return res
  if (res && typeof res === 'object') {
    for (const value of Object.values(res)) {
      if (!value || typeof value !== 'object') continue
      const nested = pickList(value, ...keys)
      if (nested.length) return nested
    }
  }
  return []
}

function normalizeFrame(frame) {
  const image = frame.image && typeof frame.image === 'object'
    ? frame.image.url || frame.image.secure_url || frame.image.secureUrl
    : frame.image
  const url =
    frame.url ||
    frame.imageUrl ||
    image ||
    frame.assetUrl ||
    frame.asset?.url ||
    frame.asset?.secure_url ||
    frame.cloudinaryUrl ||
    frame.secure_url ||
    frame.secureUrl ||
    frame.mediaUrl ||
    frame.fileUrl ||
    frame.previewUrl ||
    frame.frameUrl ||
    frame.chatFrameUrl ||
    ''
  return {
    id: frame.id || frame.frameId || frame.chatFrameId || frame._id || frame.slug,
    name: frame.name || 'Chat Frame',
    price: frame.price ?? frame.priceCC ?? frame.cost ?? 0,
    url,
    desc: frame.description || frame.desc || '',
  }
}

function mergeFrameSources(...sources) {
  const map = new Map()
  sources.flat().forEach(frame => {
    const normalized = normalizeFrame(frame)
    if (!normalized.id || !normalized.url) return
    map.set(normalized.id, { ...map.get(normalized.id), ...normalized })
  })
  return Array.from(map.values())
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
    purchaseGift,
  } = useOutletContext()

  const [activeGift, setActiveGift] = useState(null)
  const [confirmGift, setConfirmGift] = useState(null)
  const [isPurchasingGift, setIsPurchasingGift] = useState(false)
  const [giftMessage, setGiftMessage] = useState('')

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
  const [cosmeticMsg, setCosmeticMsg] = useState({ text: '', ok: false })
  const [buyingFrame, setBuyingFrame] = useState(null)
  const [equippingFrame, setEquippingFrame] = useState(null)
  const [streakInfo, setStreakInfo] = useState(null)
  const [chatFrames, setChatFrames] = useState([])
  const [chatFramesLoading, setChatFramesLoading] = useState(true)

  const loadChatFrames = useCallback(async () => {
    setChatFramesLoading(true)
    const cachedFrames = getCachedChatFrames()
    try {
      const res = await getChatFrames()
      const frames = pickList(res, 'chatFrames', 'frames', 'items')
      setChatFrames(mergeFrameSources(frames, cachedFrames))
    } catch {
      setChatFrames(mergeFrameSources(cachedFrames))
    } finally {
      setChatFramesLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setChatFramesLoading(true)
      const cachedFrames = getCachedChatFrames()
      try {
        const res = await getChatFrames()
        const frames = pickList(res, 'chatFrames', 'frames', 'items')
        if (!cancelled) {
          setChatFrames(mergeFrameSources(frames, cachedFrames))
        }
      } catch {
        if (!cancelled) setChatFrames(mergeFrameSources(cachedFrames))
      } finally {
        if (!cancelled) setChatFramesLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [currentUser])

  useEffect(() => {
    if (activeSection === 'cosmetics') loadChatFrames()
  }, [activeSection, loadChatFrames])

  const validPacks = (couponPackages || []).filter(p => (p.cc || 0) > 0)
  const packs = validPacks.length ? validPacks : storePacks
  const referralRewards = (currentUser?.ccIncomeHistory || []).filter(
    (entry) => (entry.type || entry.source) === 'referral_milestone',
  )
  const referralStats = useMemo(
    () => ({
      referralsCount: currentUser?.referralsCount ?? 0,
      referralCode: currentUser?.referralCode || '',
      referralLink: currentUser?.referralCode
        ? `https://cardora.studio/signup?ref=${currentUser.referralCode}`
        : (currentUser?.referralLink || ''),
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

  const handleBuyFrame = async (frameId) => {
    if (!currentUser) { openAuthModal(); return }
    setBuyingFrame(frameId)
    setCosmeticMsg({ text: '', ok: false })
    try {
      const res = await buyChatFrame(frameId)
      setCosmeticMsg({ text: res?.message || 'Frame purchased!', ok: true })
    } catch (err) {
      setCosmeticMsg({ text: err?.message || 'Could not buy frame.', ok: false })
    }
    setBuyingFrame(null)
  }

  const handleEquipFrame = async (frameId) => {
    if (!currentUser) { openAuthModal(); return }
    setEquippingFrame(frameId)
    setCosmeticMsg({ text: '', ok: false })
    try {
      const res = await equipChatFrame(frameId)
      setCosmeticMsg({ text: res?.message || 'Frame equipped!', ok: true })
    } catch (err) {
      setCosmeticMsg({ text: err?.message || 'Could not equip frame.', ok: false })
    }
    setEquippingFrame(null)
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
            className={`tab ${activeSection === 'cosmetics' ? 'active' : ''}`}
            onClick={() => setActiveSection('cosmetics')}
          >
            Cosmetics
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
            Gifts
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

        {activeSection === 'cosmetics' && (
          <div className="store-cosmetics-section">
            <div className="store-cosmetics-intro">
              <p className="eyebrow">Chat cosmetics</p>
              <h4>Frames curated by admins</h4>
              <p>Buy a frame, equip it, and it becomes the visual treatment around your WorldChat messages.</p>
            </div>
            {cosmeticMsg.text && (
              <p className={`store-earn-msg ${cosmeticMsg.ok ? 'success' : 'error'}`}>{cosmeticMsg.text}</p>
            )}
            {chatFramesLoading ? (
              <div className="store-frame-empty">Loading uploaded frames...</div>
            ) : chatFrames.length === 0 ? (
              <div className="store-frame-empty">No uploaded chat frames are available yet.</div>
            ) : (
              <div className="store-cosmetics-grid">
                {chatFrames.map(frame => (
                  <div key={frame.id} className="store-frame-card">
                    <div className="store-frame-preview" aria-label={`${frame.name} WorldChat preview`}>
                      <div className="store-frame-chat-row">
                        <div className="store-frame-avatar-wrap">
                          <span className="store-frame-avatar">C</span>
                          <img className="store-frame-avatar-frame" src={frame.url} alt="" />
                        </div>
                        <div className="store-frame-chat-copy">
                          <div className="store-frame-chat-meta">
                            <strong>cardora</strong>
                            <span>now</span>
                          </div>
                          <div className="store-frame-chat-bubble">This is how your frame appears in World Chat.</div>
                        </div>
                      </div>
                    </div>
                    <div className="store-frame-info">
                      <strong>{frame.name}</strong>
                      {frame.desc ? <p>{frame.desc}</p> : <p>Uploaded by the admin team for WorldChat profiles.</p>}
                      <span className="store-frame-price">{frame.price} CC</span>
                    </div>
                    <div className="store-frame-actions">
                      <button
                        type="button"
                        className="primary store-frame-buy"
                        onClick={() => handleBuyFrame(frame.id)}
                        disabled={buyingFrame === frame.id}
                      >
                        {buyingFrame === frame.id ? '...' : 'Buy'}
                      </button>
                      <button
                        type="button"
                        className="ghost store-frame-equip"
                        onClick={() => handleEquipFrame(frame.id)}
                        disabled={equippingFrame === frame.id}
                      >
                        {equippingFrame === frame.id ? '...' : 'Equip'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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
                    <p>Claim {streakInfo?.isPremium ? '2 CC' : '1 CC'} every day. {streakInfo?.isPremium ? '(Premium bonus!)' : 'Premium users earn 2×!'}</p>
                    {streakInfo && streakInfo.streak > 0 && (
                      <div className="store-streak-badge">
                        <span className="store-streak-fire">🔥</span>
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

        {activeSection === 'gifts' && (
          <div className="store-gifts-shell">
            <div className="store-gifts-intro">
              <h4>Send a gift with your card</h4>
              <p>
                Each gift plays a unique particle animation in its own colour palette before
                the recipient receives it. Buy once, attach from Studio.
              </p>
            </div>
            {giftMessage && <p className="store-gift-status">{giftMessage}</p>}
            <div className="gift-grid">
              {storeGifts.map((gift) => (
                <GiftCard
                  key={gift.effectKey}
                  title={gift.title}
                  amount={gift.amount}
                  note={gift.note}
                  effectKey={gift.effectKey}
                  actionLabel="Preview"
                  onAction={() => setActiveGift(gift)}
                />
              ))}
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

      {activeGift ? (
        <GiftPreviewModal
          gift={activeGift}
          disabled={isPurchasingGift}
          onClose={() => setActiveGift(null)}
          onBuy={() => {
            if (!currentUser) {
              openAuthModal()
              return
            }
            setConfirmGift(activeGift)
            setActiveGift(null)
          }}
        />
      ) : null}

      {confirmGift ? (
        <section className="detail-modal" role="dialog" aria-modal="true">
          <div className="detail-backdrop" onClick={() => !isPurchasingGift && setConfirmGift(null)} />
          <div className="detail-card store-pay-modal">
            <div className="store-pay-hero">
              <p className="eyebrow">Gift checkout</p>
              <h3>Confirm gift purchase</h3>
              <p className="detail-subtitle">
                You will be redirected to Flutterwave to pay securely. The reveal animation appears after payment is completed.
              </p>
            </div>
            <div className="store-pay-summary">
              <div className="store-pay-row">
                <span>Gift</span>
                <strong>{confirmGift.title}</strong>
              </div>
              <div className="store-pay-row">
                <span>Value</span>
                <strong>{confirmGift.amount}</strong>
              </div>
            </div>
            <div className="detail-actions">
              <button
                className="primary"
                type="button"
                onClick={async () => {
                  setIsPurchasingGift(true)
                  setGiftMessage('')
                  const result = await purchaseGift(confirmGift)
                  if (!result?.ok) {
                    setGiftMessage(result?.reason === 'auth'
                      ? 'Please sign in to continue.'
                      : result?.reason || 'Could not start gift checkout. Please try again.')
                    setIsPurchasingGift(false)
                    setConfirmGift(null)
                    setTimeout(() => setGiftMessage(''), 2800)
                    return
                  }
                  if (!result.checkout) {
                    setGiftMessage('Gift added to your inventory!')
                    setActiveGift(null)
                    setConfirmGift(null)
                    await refreshBalance?.()
                    setTimeout(() => setGiftMessage(''), 2800)
                  }
                  setIsPurchasingGift(false)
                }}
                disabled={isPurchasingGift}
              >
                {isPurchasingGift ? 'Redirecting...' : 'Continue to Flutterwave'}
              </button>
              <button className="ghost" type="button" onClick={() => setConfirmGift(null)} disabled={isPurchasingGift}>
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

