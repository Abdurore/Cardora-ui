import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { getRewardedAd, completeAd, getAdStats, clickAd, trackAdView, redeemAdRewardGrant } from '../lib/api.js'

// 3.6: rewarded ads grant non-currency, per-card unlocks now, never CC.
// premium_feature applies automatically to whatever card the user makes
// next (nothing to pick), so it needs no redemption UI here. themed_template
// needs a marketplace template picked, not a card -- distinct target type
// from view_boost/lifetime_extension.
const GRANT_LABELS = {
  premium_feature: { emoji: '🎁', title: 'A premium feature is free on your next card!', needsCard: false },
  view_boost: { emoji: '👀', title: '+20 views on one of your cards', needsCard: true },
  lifetime_extension: { emoji: '⏳', title: "+7 days on one of your card's lifetime", needsCard: true },
  themed_template: { emoji: '🎨', title: 'A themed template unlocked for 24 hours!', needsTemplate: true },
}

const AD_COOLDOWN_SECS = 30
const MIN_WATCH_PCT = 80   // must watch 80% to get full reward
const AD_STATS_PREFIX = 'cardora:rewardedAds:'

function todayKey() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function getLocalAdStats() {
  try {
    const parsed = JSON.parse(localStorage.getItem(`${AD_STATS_PREFIX}${todayKey()}`) || '{}')
    return {
      adsWatchedToday: Number(parsed.adsWatchedToday || 0),
      ccEarnedToday: Number(parsed.ccEarnedToday || 0),
    }
  } catch {
    return { adsWatchedToday: 0, ccEarnedToday: 0 }
  }
}

function saveLocalAdStats(next) {
  try {
    localStorage.setItem(`${AD_STATS_PREFIX}${todayKey()}`, JSON.stringify({
      adsWatchedToday: Number(next.adsWatchedToday || 0),
      ccEarnedToday: Number(next.ccEarnedToday || 0),
      updatedAt: new Date().toISOString(),
    }))
  } catch { /* ignore */ }
}

function unwrapAdStats(payload) {
  const raw = payload?.data || payload || {}
  return raw?.stats || raw?.data?.stats || raw || {}
}

function adStatsNumbers(payload) {
  const raw = payload?.data || payload || {}
  const stats = unwrapAdStats(payload)
  const watched = Number(stats?.adsWatchedToday ?? stats?.watched ?? raw?.adsWatchedToday ?? 0) || 0
  const earned = Number(stats?.ccEarnedToday ?? stats?.earned ?? raw?.ccEarnedToday ?? 0) || 0
  const explicitLimit = Number(stats?.dailyLimit ?? stats?.limit ?? stats?.maxAdsToday ?? raw?.dailyLimit ?? 0) || 0
  const explicitRemaining = stats?.remainingAdsToday ?? stats?.remaining ?? raw?.remainingAdsToday
  const limit = explicitLimit || (explicitRemaining !== undefined ? watched + Number(explicitRemaining || 0) : 10)
  const remaining = Math.max(0, Number(explicitRemaining ?? (limit - watched)) || 0)
  return { raw, stats, watched, earned, remaining, limit: limit || 10 }
}

function mergeLocalAdStats(payload) {
  const local = getLocalAdStats()
  const { raw, stats, watched, earned, remaining, limit } = adStatsNumbers(payload)
  const mergedWatched = Math.max(watched, local.adsWatchedToday)
  const mergedEarned = Math.max(earned, local.ccEarnedToday)
  const mergedRemaining = Math.max(0, Math.min(remaining, limit - mergedWatched))

  return {
    ...raw,
    adsWatchedToday: mergedWatched,
    remainingAdsToday: mergedRemaining,
    ccEarnedToday: mergedEarned,
    stats: {
      ...stats,
      adsWatchedToday: mergedWatched,
      remainingAdsToday: mergedRemaining,
      ccEarnedToday: mergedEarned,
      dailyLimit: limit,
    },
  }
}

function RewardedAds({ onBalanceUpdate }) {
  const { getUserCardsFromBackend, marketplaceTemplates } = useOutletContext() || {}
  const [ad, setAd] = useState(null)
  const [stats, setStats] = useState(null)
  const [phase, setPhase] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [reward, setReward] = useState(null)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [muted, setMuted] = useState(false)
  const [, setWatchedSecs] = useState(0)
  const [grant, setGrant] = useState(null)
  const [userCards, setUserCards] = useState(null)
  const [selectedCardId, setSelectedCardId] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [redeemState, setRedeemState] = useState('idle') // idle | redeeming | done | error
  const [redeemMsg, setRedeemMsg] = useState('')

  const timerRef = useRef(null)       // fallback interval for non-video ads
  const cooldownRef = useRef(null)
  const videoRef = useRef(null)

  // themed_template's picker only offers templates actually worth unlocking
  // -- priced (isLocked) ones. A free template has nothing to grant.
  const lockedTemplates = useMemo(
    () => (marketplaceTemplates || []).filter((t) => t.isLocked && Number(t.price) > 0),
    [marketplaceTemplates],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await getAdStats()
        if (!cancelled) setStats(mergeLocalAdStats(res))
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      clearInterval(cooldownRef.current)
    }
  }, [])

  const startCooldown = (secs = AD_COOLDOWN_SECS) => {
    setCooldown(secs)
    clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  useEffect(() => {
    if (cooldown === 0 && phase === 'cooldown') {
      setPhase('idle')
    }
  }, [cooldown, phase])

  const handleComplete = useCallback(async (adData) => {
    clearInterval(timerRef.current)
    setPhase('completing')
    try {
      const res = await completeAd({ adId: adData.id || adData._id })
      // Phase 2.1: only trust what the backend actually says was granted
      // (`rewardCC`, the sole field /ads/complete returns for this). The
      // old fallback chain (adData.rewardCC, a hardcoded 2) showed the
      // *advertised* reward regardless of what was actually credited --
      // since 1.5 removed the CC grant from this endpoint entirely, that
      // chain would now show a fake "+2 CC" for an ad that granted zero.
      const amountEarned = Number(res?.rewardCC ?? 0)
      setReward({ cc: res?.cc || 0, amount: amountEarned })

      // 3.6: the real reward now, if the daily grant cap (3/day) hasn't
      // been hit -- a per-card unlock, never CC.
      const grantData = res?.grant || null
      setGrant(grantData)
      setSelectedCardId('')
      setSelectedTemplateId('')
      setRedeemState('idle')
      setRedeemMsg('')
      if (grantData && GRANT_LABELS[grantData.grantType]?.needsCard && !userCards) {
        getUserCardsFromBackend?.().then((r) => {
          if (r?.ok) setUserCards(r.cards || [])
        }).catch(() => {})
      }

      setStats(prev => {
        const mergedPrev = mergeLocalAdStats(prev)
        const { raw: pRaw, stats: pStats, watched, earned, remaining } = adStatsNumbers(mergedPrev)
        const nextWatched = watched + 1
        const nextEarned = earned + amountEarned
        const nextRemaining = Math.max(0, remaining - 1)
        saveLocalAdStats({ adsWatchedToday: nextWatched, ccEarnedToday: nextEarned })
        
        return {
          ...pRaw,
          adsWatchedToday: nextWatched,
          remainingAdsToday: nextRemaining,
          ccEarnedToday: nextEarned,
          stats: {
            ...pStats,
            adsWatchedToday: nextWatched,
            remainingAdsToday: nextRemaining,
            ccEarnedToday: nextEarned
          }
        }
      })
      
      onBalanceUpdate?.()
      setPhase('done')
      startCooldown()
    } catch (err) {
      setError(err.message || 'Could not claim reward.')
      setPhase('error')
    }
  }, [onBalanceUpdate, userCards, getUserCardsFromBackend])

  const handleRedeemGrant = async () => {
    const needsTemplate = GRANT_LABELS[grant?.grantType]?.needsTemplate
    const target = needsTemplate ? selectedTemplateId : selectedCardId
    if (!grant || !target) return
    setRedeemState('redeeming')
    setRedeemMsg('')
    try {
      const res = await redeemAdRewardGrant(
        needsTemplate
          ? { token: grant.token, templateId: selectedTemplateId }
          : { token: grant.token, cardId: selectedCardId },
      )
      setRedeemState('done')
      setRedeemMsg(res?.message || 'Applied!')
    } catch (err) {
      setRedeemState('error')
      setRedeemMsg(err.message || 'Could not apply your reward.')
    }
  }

  const loadAd = async () => {
    setPhase('loading')
    setError('')
    setReward(null)
    setGrant(null)
    setUserCards(null)
    setSelectedCardId('')
    setSelectedTemplateId('')
    setRedeemState('idle')
    setRedeemMsg('')
    setWatchedSecs(0)
    setProgress(0)
    try {
      const res = await getRewardedAd()
      const adData = res?.ad || res?.data?.ad || res?.data || res
      // An ad is "real" if it has any of the identifying fields. Without a real
      // ad, surface the backend's own message so admins can debug active state.
      const looksLikeAd = adData && typeof adData === 'object' && (
        adData.id || adData._id || adData.videoUrl || adData.imageUrl || adData.name
      )
      if (!looksLikeAd) {
        console.warn('[RewardedAds] no ad in response:', res)
        const backendMsg = res?.message || res?.error || res?.data?.message
        setError(backendMsg || 'No ads available right now. If admin shows ads as active, you may have hit your daily limit or each ad\'s view cap.')
        setPhase('idle')
        return
      }
      setAd(adData)
      setPhase('watching')
      const adId = adData.id || adData._id
      if (adId) {
        trackAdView(adId).catch(err => console.warn('[RewardedAds] View tracking failed:', err))
      }

      // Fallback timer for non-video ads (image/placeholder)
      if (!adData.videoUrl) {
        const duration = (adData.duration || 15) * 1000
        const start = Date.now()
        timerRef.current = setInterval(() => {
          const pct = Math.min(((Date.now() - start) / duration) * 100, 100)
          setProgress(pct)
          if (pct >= 100) { clearInterval(timerRef.current); handleComplete(adData) }
        }, 250)
      }
    } catch (err) {
      setError(err.message || 'Could not load ad.')
      setPhase('idle')
    }
  }

  // Video event handlers
  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current
    if (!v || !v.duration) return
    const pct = (v.currentTime / v.duration) * 100
    setProgress(pct)
    setWatchedSecs(v.currentTime)
  }, [])

  const handleVideoEnded = useCallback(() => {
    if (ad) handleComplete(ad)
  }, [ad, handleComplete])

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted
      setMuted(videoRef.current.muted)
    }
  }

  const toggleFullscreen = () => {
    const v = videoRef.current
    if (!v) return
    if (v.requestFullscreen) v.requestFullscreen()
    else if (v.webkitRequestFullscreen) v.webkitRequestFullscreen()
    else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen()
  }

  // Deeply unwrap the stats response — backend may return nested shapes
  const displayStats = mergeLocalAdStats(stats)
  const { watched: adsWatched, remaining } = adStatsNumbers(displayStats)
  const cooldownPct = Math.round(((AD_COOLDOWN_SECS - cooldown) / AD_COOLDOWN_SECS) * 100)
  const ctaUrl = ad?.ctaUrl || ad?.actionUrl || ad?.url || ad?.link || ad?.linkUrl

  // 3.6: rewards are per-card unlocks now, capped separately (3/day) from
  // how many ads can be watched (10/day) -- earned/CC tracking above is kept
  // only because it's always 0 and thus harmless, not because CC is still
  // the reward.
  const rawStats = stats?.data?.stats || stats?.stats || stats || {}
  const grantsRemaining = rawStats.grantsRemainingToday

  return (
    <div className="rad-container">
      <div className="rad-header">
        <span className="rad-icon">🎬</span>
        <div>
          <h4 className="rad-title">Watch & Earn</h4>
          <p className="rad-desc">Watch a short video and earn a reward — a free feature, extra views, or more time on a card. Up to 3 rewards a day.</p>
        </div>
      </div>

      {stats && (
        <div className="rad-stats">
          <div className="rad-stat"><strong>{adsWatched}</strong><span>Watched</span></div>
          <div className="rad-stat"><strong>{remaining !== null ? remaining : '—'}</strong><span>Remaining</span></div>
          <div className="rad-stat"><strong>{grantsRemaining ?? '—'}</strong><span>Rewards Left Today</span></div>
        </div>
      )}

      {phase === 'idle' && (
        <button className="rad-watch-btn" type="button" onClick={loadAd} disabled={stats && remaining !== null && remaining <= 0}>
          {stats && remaining !== null && remaining <= 0 ? 'Daily Limit Reached' : '▶ Watch Ad & Earn Reward'}
        </button>
      )}

      {phase === 'cooldown' && (
        <div className="rad-cooldown">
          <div className="rad-cooldown-ring">
            <svg viewBox="0 0 44 44" className="rad-cooldown-svg">
              <circle cx="22" cy="22" r="18" className="rad-cooldown-track" />
              <circle cx="22" cy="22" r="18" className="rad-cooldown-fill"
                strokeDasharray={`${(cooldownPct / 100) * 113} 113`} strokeDashoffset="0" />
            </svg>
            <span className="rad-cooldown-num">{cooldown}</span>
          </div>
          <p className="rad-cooldown-label">Next ad in <strong>{cooldown}s</strong></p>
          <div className="rad-progress-bar"><div className="rad-cooldown-bar-fill" style={{ width: `${cooldownPct}%` }} /></div>
        </div>
      )}

      {phase === 'loading' && (
        <div className="rad-loading"><div className="chat-loading-spinner" /><p>Loading ad...</p></div>
      )}

      {phase === 'watching' && ad && (
        <div className="rad-player">
          {ad.videoUrl ? (
            <video
              ref={videoRef}
              src={ad.videoUrl}
              autoPlay
              playsInline
              muted={muted}
              className="rad-video"
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleVideoEnded}
            />
          ) : (
            <div className="rad-placeholder">
              {ad.imageUrl ? <img src={ad.imageUrl} alt={ad.name || 'Ad'} style={{ width: '100%', maxHeight: 200, objectFit: 'contain' }} /> : <><span>📺</span><p>{ad.name || 'Ad playing...'}</p></>}
            </div>
          )}

          {/* Top overlay: brand label */}
          <div className="rad-overlay-top">
            <span className="rad-brand-pill">{ad.brand || ad.name || ad.advertiser || 'Sponsored'}</span>
          </div>

          {/* Bottom overlay: CTA + controls */}
          <div className="rad-overlay-bottom">
            {ctaUrl ? (
              <a
                href={ctaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rad-cta-btn"
                onClick={async () => {
                  const adId = ad.id || ad._id
                  if (adId) {
                    try { await clickAd(adId) }
                    catch (err) { console.warn('[RewardedAds] Click tracking failed:', err) }
                  }
                }}
              >
                {ad.ctaText || ad.actionText || 'Learn More →'}
              </a>
            ) : <span />}
            <div className="rad-video-controls">
              {ad.videoUrl && (
                <>
                  <button type="button" className="rad-ctrl-btn" onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
                    {muted ? '🔇' : '🔊'}
                  </button>
                  <button type="button" className="rad-ctrl-btn" onClick={toggleFullscreen} title="Fullscreen">
                    ⛶
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="rad-progress-bar">
            <div className="rad-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="rad-progress-text">{Math.round(progress)}% watched — watch to the end to earn your reward</p>
        </div>
      )}

      {phase === 'completing' && (
        <div className="rad-loading"><div className="chat-loading-spinner" /><p>Claiming reward...</p></div>
      )}

      {phase === 'done' && reward && (
        <div className="rad-reward">
          {grant ? (
            <>
              <span className="rad-reward-icon">{GRANT_LABELS[grant.grantType]?.emoji || '🎁'}</span>
              <h4>{GRANT_LABELS[grant.grantType]?.title || 'Reward earned!'}</h4>
              {GRANT_LABELS[grant.grantType]?.needsCard ? (
                redeemState === 'done' ? (
                  <p className="success">{redeemMsg}</p>
                ) : (
                  <div className="rad-grant-redeem">
                    <select
                      value={selectedCardId}
                      onChange={(e) => setSelectedCardId(e.target.value)}
                      disabled={!userCards || userCards.length === 0}
                    >
                      <option value="">
                        {userCards === null ? 'Loading your cards…' : userCards.length === 0 ? 'No cards yet' : 'Choose a card'}
                      </option>
                      {(userCards || []).map((c) => (
                        <option key={c.id} value={c.id}>{c.header || c.slug || c.id}</option>
                      ))}
                    </select>
                    <button
                      className="rad-watch-btn"
                      type="button"
                      onClick={handleRedeemGrant}
                      disabled={!selectedCardId || redeemState === 'redeeming'}
                    >
                      {redeemState === 'redeeming' ? 'Applying…' : 'Apply to card'}
                    </button>
                    {redeemState === 'error' && <p className="form-error">{redeemMsg}</p>}
                  </div>
                )
              ) : GRANT_LABELS[grant.grantType]?.needsTemplate ? (
                redeemState === 'done' ? (
                  <p className="success">{redeemMsg}</p>
                ) : (
                  <div className="rad-grant-redeem">
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      disabled={!lockedTemplates.length}
                    >
                      <option value="">
                        {lockedTemplates.length === 0 ? 'No locked templates to unlock' : 'Choose a template'}
                      </option>
                      {lockedTemplates.map((t) => (
                        <option key={t.id} value={t.id}>{t.title || t.id}</option>
                      ))}
                    </select>
                    <button
                      className="rad-watch-btn"
                      type="button"
                      onClick={handleRedeemGrant}
                      disabled={!selectedTemplateId || redeemState === 'redeeming'}
                    >
                      {redeemState === 'redeeming' ? 'Applying…' : 'Unlock template'}
                    </button>
                    {redeemState === 'error' && <p className="form-error">{redeemMsg}</p>}
                  </div>
                )
              ) : (
                <p>It'll apply automatically the next time you create a card.</p>
              )}
            </>
          ) : (
            <>
              <span className="rad-reward-icon">🙌</span>
              <h4>Thanks for watching!</h4>
              <p>You've hit today's reward limit — come back tomorrow for more.</p>
            </>
          )}
          {remaining > 1 ? (
            <button className="rad-watch-btn" type="button" onClick={() => {
              setAd(null);
              if (cooldown > 0) setPhase('cooldown');
              else setPhase('idle');
            }}>Watch Another</button>
          ) : (
            <button className="rad-watch-btn" type="button" onClick={() => { setPhase('idle'); setAd(null) }}>Done</button>
          )}
        </div>
      )}

      {(phase === 'error' || error) && (
        <div className="rad-error">
          <p>{error}</p>
          <button className="rad-watch-btn" type="button" onClick={() => { setPhase('idle'); setError('') }}>Try Again</button>
        </div>
      )}
    </div>
  )
}

export default RewardedAds
