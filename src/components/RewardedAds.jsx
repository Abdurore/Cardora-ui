import { useEffect, useRef, useState, useCallback } from 'react'
import { getRewardedAd, completeAd, getAdStats } from '../lib/api.js'

const AD_COOLDOWN_SECS = 30
const MIN_WATCH_PCT = 80   // must watch 80% to get full reward
const SKIP_AFTER_SECS = 5  // skip button appears after 5s

function RewardedAds({ onBalanceUpdate }) {
  const [ad, setAd] = useState(null)
  const [stats, setStats] = useState(null)
  const [phase, setPhase] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [reward, setReward] = useState(null)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [muted, setMuted] = useState(false)
  const [canSkip, setCanSkip] = useState(false)
  const [watchedSecs, setWatchedSecs] = useState(0)

  const timerRef = useRef(null)       // fallback interval for non-video ads
  const cooldownRef = useRef(null)
  const skipTimerRef = useRef(null)
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
  }, [reward])

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      clearInterval(cooldownRef.current)
      clearTimeout(skipTimerRef.current)
    }
  }, [])

  const startCooldown = (secs = AD_COOLDOWN_SECS) => {
    setCooldown(secs)
    setPhase('cooldown')
    clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current); setPhase('idle'); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  const handleComplete = useCallback(async (adData) => {
    clearInterval(timerRef.current)
    clearTimeout(skipTimerRef.current)
    setPhase('completing')
    try {
      const res = await completeAd({ adId: adData.id || adData._id })
      setReward({ cc: res?.cc || 0, amount: res?.rewardAmount || adData.rewardCC || res?.reward || 2 })
      onBalanceUpdate?.()
      setPhase('done')
    } catch (err) {
      setError(err.message || 'Could not claim reward.')
      setPhase('error')
    }
  }, [onBalanceUpdate])

  const loadAd = async () => {
    setPhase('loading')
    setError('')
    setReward(null)
    setCanSkip(false)
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

      // Skip button after SKIP_AFTER_SECS
      skipTimerRef.current = setTimeout(() => setCanSkip(true), SKIP_AFTER_SECS * 1000)

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

  const handleSkip = () => {
    if (ad) handleComplete(ad)
  }

  const adsWatched = stats?.adsWatchedToday ?? stats?.watched ?? 0
  const remaining = stats?.remainingAdsToday ?? stats?.remaining ?? 10
  const earned = stats?.ccEarnedToday ?? stats?.earned ?? 0
  const cooldownPct = Math.round(((AD_COOLDOWN_SECS - cooldown) / AD_COOLDOWN_SECS) * 100)
  const ctaUrl = ad?.ctaUrl || ad?.actionUrl || ad?.url || ad?.link

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
          <div className="rad-stat"><strong>{remaining}</strong><span>Remaining</span></div>
          <div className="rad-stat"><strong>{earned} CC</strong><span>Earned Today</span></div>
        </div>
      )}

      {phase === 'idle' && (
        <button className="rad-watch-btn" type="button" onClick={loadAd} disabled={remaining <= 0}>
          {remaining <= 0 ? 'Daily Limit Reached' : '▶ Watch Ad & Earn CC'}
        </button>
      )}

      {phase === 'cooldown' && (
        <div className="rad-cooldown">
          <div className="rad-cooldown-ring">
            <svg viewBox="0 0 44 44" className="rad-cooldown-svg">
              <circle cx="22" cy="22" r="18" className="rad-cooldown-track" />
              <circle cx="22" cy="22" r="18" className="rad-cooldown-fill"
                strokeDasharray={`${(cooldownPct / 100) * 113} 113`} strokeDashoffset="28" />
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

          {/* Top overlay: brand label + skip */}
          <div className="rad-overlay-top">
            <span className="rad-brand-pill">{ad.brand || ad.name || ad.advertiser || 'Sponsored'}</span>
            {canSkip && (
              <button type="button" className="rad-skip-btn" onClick={handleSkip}>Skip Ad →</button>
            )}
          </div>

          {/* Bottom overlay: CTA + controls */}
          <div className="rad-overlay-bottom">
            {ctaUrl ? (
              <a href={ctaUrl} target="_blank" rel="noopener noreferrer" className="rad-cta-btn">
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
          <p className="rad-progress-text">{Math.round(progress)}% watched — {canSkip ? 'You can skip' : `Skip in ${Math.max(0, SKIP_AFTER_SECS - Math.floor(watchedSecs))}s`}</p>
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
            <button className="rad-watch-btn" type="button" onClick={() => { setAd(null); startCooldown() }}>Watch Another</button>
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
