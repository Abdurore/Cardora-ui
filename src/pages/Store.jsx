import { useCallback, useMemo, useState, useEffect, useRef } from 'react'
import { useOutletContext, useNavigate, useLocation } from 'react-router-dom'
import { IoSparkles } from 'react-icons/io5'
import { TiGift } from 'react-icons/ti'
import { MdHandshake } from 'react-icons/md'
import { HiOutlineFire } from 'react-icons/hi2'
import ScreenHeader from '../components/ScreenHeader.jsx'
import ScreenNav from '../components/ScreenNav.jsx'
import PackCard from '../components/PackCard.jsx'
import RewardedAds from '../components/RewardedAds.jsx'
import { storePacks, storeGifts } from '../data/catalog.js'
import GiftCard from '../components/GiftCard.jsx'
import GiftPreviewModal from '../components/GiftPreviewModal.jsx'
import { buyChatFrame, equipChatFrame, getUserCoupons, getChatFrames, getOwnedChatFrames, getCachedChatFrames } from '../lib/api.js'
import { getChatFrameId, getEquippedChatFrameId, getLocalEquippedChatFrameId, getOwnedChatFrameIds, normalizeChatFrame, setLocalEquippedChatFrameId } from '../lib/chatFrames.js'

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
  return normalizeChatFrame(frame)
}

function mergeFrameSources(...sources) {
  const map = new Map()
  sources.flat().forEach(frame => {
    const normalized = normalizeFrame(frame)
    if (!normalized?.id || !normalized.url) return
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
    authReady,
  } = useOutletContext()

  const navigate = useNavigate()

  const [activeGift, setActiveGift] = useState(null)
  const [confirmGift, setConfirmGift] = useState(null)
  const [isPurchasingGift, setIsPurchasingGift] = useState(false)
  const [giftMessage, setGiftMessage] = useState('')

  const [checkoutMessage, setCheckoutMessage] = useState('')
  const [activePack, setActivePack] = useState(null)
  const [isLaunchingCheckout, setIsLaunchingCheckout] = useState(false)
  const location = useLocation()
  const queryTab = useMemo(() => {
    const search = new URLSearchParams(location.search)
    return search.get('tab')
  }, [location.search])

  const [activeSection, setActiveSection] = useState('buy')

  useEffect(() => {
    if (queryTab && ['buy', 'cosmetics', 'rewards'].includes(queryTab)) {
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
  const [cosmeticMsg, setCosmeticMsg] = useState({ text: '', ok: false })
  const [buyingFrame, setBuyingFrame] = useState(null)
  const [equippingFrame, setEquippingFrame] = useState(null)
  const [streakInfo, setStreakInfo] = useState(null)
  const [chatFrames, setChatFrames] = useState([])
  const [ownedFrameIds, setOwnedFrameIds] = useState([])
  const [localEquippedFrameId, setLocalEquippedFrameId] = useState('')
  // Persist optimistic owned IDs across re-renders so a background refetch can't wipe them
  const optimisticOwnedIds = useRef(new Set())
  const [chatFramesLoading, setChatFramesLoading] = useState(true)

  const loadChatFrames = useCallback(async () => {
    setChatFramesLoading(true)
    const cachedFrames = getCachedChatFrames()
    try {
      const [res, ownedRes] = await Promise.allSettled([
        getChatFrames(),
        getOwnedChatFrames()
      ])
      const frames = res.status === 'fulfilled' ? pickList(res.value, 'chatFrames', 'frames', 'items') : []
      const owned = ownedRes.status === 'fulfilled' ? pickList(ownedRes.value, 'chatFrames', 'frames', 'items') : []
      // Merge backend owned IDs with any optimistic ones the user triggered this session
      owned.forEach(f => {
        const id = getChatFrameId(f)
        if (id) optimisticOwnedIds.current.add(id)
      })
      setChatFrames(mergeFrameSources(frames, owned, cachedFrames))
      setOwnedFrameIds([...optimisticOwnedIds.current])
    } catch {
      setChatFrames(mergeFrameSources(cachedFrames))
      setOwnedFrameIds([...optimisticOwnedIds.current])
    } finally {
      setChatFramesLoading(false)
    }
  }, [])

  // Run once on mount — never depends on currentUser to avoid wiping optimistic state
  useEffect(() => {
    loadChatFrames()
  }, [loadChatFrames])

  useEffect(() => {
    const localFrameId = getLocalEquippedChatFrameId(currentUser?.id)
    setLocalEquippedFrameId(localFrameId === '__frameless__' ? '' : (localFrameId || getEquippedChatFrameId(currentUser)))
    getOwnedChatFrameIds(currentUser).forEach(id => optimisticOwnedIds.current.add(id))
    setOwnedFrameIds([...optimisticOwnedIds.current])
  }, [currentUser])

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
      // Add to optimistic ref FIRST so no refetch can wipe it
      optimisticOwnedIds.current.add(frameId)
      setOwnedFrameIds(prev => [...new Set([...prev, frameId])])
      await refreshBalance?.()
    } catch (err) {
      setCosmeticMsg({ text: err?.message || 'Could not buy frame.', ok: false })
    }
    setBuyingFrame(null)
  }

  const handleEquipFrame = async (frameId) => {
    if (!currentUser) { openAuthModal(); return }
    const nextFrameId = frameId || ''
    setEquippingFrame(nextFrameId || 'frameless')
    setCosmeticMsg({ text: '', ok: false })
    try {
      const res = await equipChatFrame(nextFrameId)
      setLocalEquippedFrameId(nextFrameId)
      setLocalEquippedChatFrameId(currentUser.id, nextFrameId)
      setCosmeticMsg({ text: res?.message || (nextFrameId ? 'Frame equipped!' : 'Frame removed.'), ok: true })
      await refreshBalance?.()
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
            className="tab"
            onClick={() => navigate('/store/gifts')}
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
            {!authReady ? (
              <div className="store-frame-empty">Loading store packages...</div>
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

        {activeSection === 'cosmetics' && (
          <div className="store-cosmetics-section">
            <div className="store-cosmetics-intro">
              <p className="eyebrow">Chat cosmetics</p>
              <h4>Chat Frames</h4>
              <p>Equip a frame to wrap every message you send in World Chat with a unique border style.</p>
            </div>
            {cosmeticMsg.text && (
              <p className={`store-earn-msg ${cosmeticMsg.ok ? 'success' : 'error'}`}>{cosmeticMsg.text}</p>
            )}
            {chatFramesLoading ? (
              <div className="store-frame-empty">
                <span className="store-frame-empty-icon">🖼️</span>
                <span>Loading frames...</span>
              </div>
            ) : chatFrames.length === 0 ? (
              <div className="store-frame-empty">
                <span className="store-frame-empty-icon">🖼️</span>
                <span>No chat frames available yet. Check back soon!</span>
              </div>
            ) : (() => {
              const currentEquippedId = localEquippedFrameId || getEquippedChatFrameId(currentUser)
              const isFrameOwned = (frame) => {
                if (!frame?.id) return false
                if (frame.isOwned || frame.owned || frame.purchased || frame.id === currentEquippedId || ownedFrameIds.includes(frame.id)) return true
                return getOwnedChatFrameIds(currentUser).includes(frame.id)
              }
              const ownedFrames = chatFrames.filter(isFrameOwned)
              const storeFrames = chatFrames.filter(f => !isFrameOwned(f))

              const renderFrameCard = (frame, isOwned) => {
                const isEquipped = currentEquippedId === frame.id
                const isEquipping = equippingFrame === frame.id || (isEquipped && equippingFrame === 'frameless')
                const isBuying = buyingFrame === frame.id
                const previewAvatarUrl = currentUser?.avatarUrl || currentUser?.profilePictureUrl || currentUser?.avatar || ''
                return (
                  <div key={frame.id} className={`cf-card ${isEquipped ? 'cf-card--equipped' : ''} ${isOwned ? 'cf-card--owned' : ''}`}>
                    {isEquipped && (
                      <div className="cf-equipped-badge">
                        <span>✦ Equipped</span>
                      </div>
                    )}
                    <div className="cf-preview" aria-label={`${frame.name} WorldChat preview`}>
                      <div className="cf-preview-inner">
                        <div className="cf-avatar-wrap">
                          {previewAvatarUrl ? (
                            <img className="cf-avatar cf-avatar-img" src={previewAvatarUrl} alt="" />
                          ) : (
                            <span className="cf-avatar">
                              {(currentUser?.name || currentUser?.username || 'C')[0].toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="cf-bubble-col">
                          <div className="cf-bubble-meta">
                            <strong>{currentUser?.username || 'cardora'}</strong>
                            <span>now</span>
                          </div>
                          <div className="cf-bubble-wrap">
                            <img
                              className="cf-frame-overlay"
                              src={frame.url}
                              alt=""
                              aria-hidden="true"
                            />
                            <div className="cf-bubble-text">
                              Hey! This frame looks great 🔥
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="cf-info">
                      <div className="cf-info-top">
                        <span className="cf-name">{frame.name}</span>
                        {!isOwned && <span className="cf-price">{frame.price} CC</span>}
                        {isOwned && !isEquipped && <span className="cf-owned-tag">Owned</span>}
                        {isEquipped && <span className="cf-equipped-tag">✦ Equipped</span>}
                      </div>
                      {frame.desc && <p className="cf-desc">{frame.desc}</p>}
                    </div>

                    <div className="cf-actions">
                      {isOwned ? (
                        <button
                          type="button"
                          className={`cf-btn ${isEquipped ? 'cf-btn--equipped' : 'cf-btn--equip'}`}
                          onClick={() => handleEquipFrame(isEquipped ? null : frame.id)}
                          disabled={isEquipping}
                        >
                          {isEquipping ? (
                            <span className="cf-btn-spinner" />
                          ) : isEquipped ? (
                            'Remove Frame'
                          ) : (
                            'Equip Frame'
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="cf-btn cf-btn--buy"
                          onClick={() => handleBuyFrame(frame.id)}
                          disabled={isBuying}
                        >
                          {isBuying ? (
                            <span className="cf-btn-spinner" />
                          ) : (
                            <>Buy for {frame.price} CC</>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )
              }

              return (
                <div className="store-cosmetics-content">
                  {ownedFrames.length > 0 && (
                    <div className="cf-section">
                      <div className="cf-section-header">
                        <h5 className="cf-section-title">Your Collection</h5>
                        <span className="cf-section-count">{ownedFrames.length} frame{ownedFrames.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="cf-grid">
                        {ownedFrames.map(f => renderFrameCard(f, true))}
                      </div>
                    </div>
                  )}

                  {storeFrames.length > 0 && (
                    <div className="cf-section">
                      <div className="cf-section-header">
                        <h5 className="cf-section-title">Available in Store</h5>
                        <span className="cf-section-count">{storeFrames.length} available</span>
                      </div>
                      <div className="cf-grid">
                        {storeFrames.map(f => renderFrameCard(f, false))}
                      </div>
                    </div>
                  )}

                  {storeFrames.length === 0 && ownedFrames.length > 0 && (
                    <div className="store-frame-empty" style={{ marginTop: '12px' }}>
                      <span className="store-frame-empty-icon">🎉</span>
                      <span>You own all available frames!</span>
                    </div>
                  )}
                </div>
              )
            })()}
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
                    <p>Claim {streakInfo?.isPremium ? '2 CC' : '1 CC'} every day. {streakInfo?.isPremium ? '(Premium bonus!)' : 'Premium users earn 2×!'}</p>
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

