import { useEffect, useRef, useState, useCallback } from 'react'
import { getRewardedAd, completeAd, getAdStats, clickAd, trackAdView } from '../lib/api.js'

const AD_COOLDOWN_SECS = 30
const MIN_WATCH_PCT = 80   // must watch 80% to get full reward

function RewardedAds({ onBalanceUpdate }) {
  const [ad, setAd] = useState(null)
  const [stats, setStats] = useState(null)
  const [phase, setPhase] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [reward, setReward] = useState(null)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [muted, setMuted] = useState(false)
  const [watchedSecs, setWatchedSecs] = useState(0)

  const timerRef = useRef(null)       // fallback interval for non-video ads
  const cooldownRef = useRef(null)
  const videoRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await getAdStats()
        if (!cancelled) setStats(res?.data || res)
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
      const amountEarned = res?.rewardAmount || adData.rewardCC || res?.reward || 2
      setReward({ cc: res?.cc || 0, amount: amountEarned })
      
      setStats(prev => {
        const pRaw = prev?.data || prev || {}
        const pStats = pRaw?.stats || pRaw?.data?.stats || pRaw || {}
        const currentWatched = pStats?.adsWatchedToday ?? pStats?.watched ?? pRaw?.adsWatchedToday ?? 0
        const currentEarned = pStats?.ccEarnedToday ?? pStats?.earned ?? pRaw?.ccEarnedToday ?? 0
        const currentRemaining = pStats?.remainingAdsToday ?? pStats?.remaining ?? pRaw?.remainingAdsToday ?? Math.max(0, 10 - currentWatched)
        
        return {
          ...pRaw,
          adsWatchedToday: currentWatched + 1,
          remainingAdsToday: Math.max(0, currentRemaining - 1),
          ccEarnedToday: currentEarned + amountEarned,
          stats: {
            ...pStats,
            adsWatchedToday: currentWatched + 1,
            remainingAdsToday: Math.max(0, currentRemaining - 1),
            ccEarnedToday: currentEarned + amountEarned
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
  }, [onBalanceUpdate])

  const loadAd = async () => {
    setPhase('loading')
    setError('')
    setReward(null)
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
  const _raw = stats?.data || stats
  const adStats = _raw?.stats || _raw?.data?.stats || _raw || {}
  const adsWatched = adStats?.adsWatchedToday ?? adStats?.watched ?? _raw?.adsWatchedToday ?? 0
  const remaining = adStats?.remainingAdsToday ?? adStats?.remaining ?? _raw?.remainingAdsToday ?? Math.max(0, 10 - adsWatched)
  const earned = adStats?.ccEarnedToday ?? adStats?.earned ?? _raw?.ccEarnedToday ?? 0
  const cooldownPct = Math.round(((AD_COOLDOWN_SECS - cooldown) / AD_COOLDOWN_SECS) * 100)
  const ctaUrl = ad?.ctaUrl || ad?.actionUrl || ad?.url || ad?.link || ad?.linkUrl

  return (
    <div className="rad-container">
      <div className="rad-header">
        <span className="rad-icon">🎬</span>
        <div>
          <h4 className="rad-title">Watch & Earn</h4>
          <p className="rad-desc">Watch a short video and earn CC. Up to 10 per day.</p>
        </div>
      </div>

      {stats && (
        <div className="rad-stats">
          <div className="rad-stat"><strong>{adsWatched}</strong><span>Watched</span></div>
          <div className="rad-stat"><strong>{remaining !== null ? remaining : '—'}</strong><span>Remaining</span></div>
          <div className="rad-stat"><strong>{earned} CC</strong><span>Earned Today</span></div>
        </div>
      )}

      {phase === 'idle' && (
        <button className="rad-watch-btn" type="button" onClick={loadAd} disabled={stats && remaining !== null && remaining <= 0}>
          {stats && remaining !== null && remaining <= 0 ? 'Daily Limit Reached' : '▶ Watch Ad & Earn CC'}
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
          <p className="rad-progress-text">{Math.round(progress)}% watched — watch to the end to earn CC</p>
        </div>
      )}

      {phase === 'completing' && (
        <div className="rad-loading"><div className="chat-loading-spinner" /><p>Claiming reward...</p></div>
      )}

      {phase === 'done' && reward && (
        <div className="rad-reward">
          <span className="rad-reward-icon">🎉</span>
          <h4>+{reward.amount} CC earned!</h4>
          <p>Your new balance has been updated.</p>
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
