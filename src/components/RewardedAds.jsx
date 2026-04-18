import { useEffect, useRef, useState } from 'react'
import { getRewardedAd, completeAd, getAdStats } from '../lib/api.js'

const AD_COOLDOWN_SECS = 30

function RewardedAds({ onBalanceUpdate }) {
  const [ad, setAd] = useState(null)
  const [stats, setStats] = useState(null)
  const [phase, setPhase] = useState('idle') // idle, cooldown, loading, watching, completing, done, error
  const [progress, setProgress] = useState(0)
  const [reward, setReward] = useState(null)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const timerRef = useRef(null)
  const cooldownRef = useRef(null)
  const startRef = useRef(null)
  const videoRef = useRef(null)

  // Load stats
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await getAdStats()
        if (!cancelled) setStats(res)
      } catch { /* ignore if endpoint not ready */ }
    })()
    return () => { cancelled = true }
  }, [reward])

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      clearInterval(cooldownRef.current)
    }
  }, [])

  const startCooldown = (secs = AD_COOLDOWN_SECS) => {
    setCooldown(secs)
    setPhase('cooldown')
    clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current)
          setPhase('idle')
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const loadAd = async () => {
    setPhase('loading')
    setError('')
    setReward(null)
    try {
      const res = await getRewardedAd()
      const adData = res?.ad || res?.data?.ad || res
      if (!adData?.id && !adData?._id) {
        setError('No ads available right now. Try again later.')
        setPhase('idle')
        return
      }
      setAd(adData)
      setPhase('watching')
      setProgress(0)
      startRef.current = Date.now()
      const duration = (adData.duration || 30) * 1000
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startRef.current
        const pct = Math.min((elapsed / duration) * 100, 100)
        setProgress(pct)
        if (pct >= 100) {
          clearInterval(timerRef.current)
          handleComplete(adData)
        }
      }, 250)
    } catch (err) {
      setError(err.message || 'Could not load ad.')
      setPhase('idle')
    }
  }

  const handleComplete = async (adData) => {
    setPhase('completing')
    try {
      const res = await completeAd({ adId: adData.id || adData._id })
      setReward({
        cc: res?.cc || 0,
        amount: res?.rewardAmount || adData.rewardCC || 2,
      })
      onBalanceUpdate?.()
      setPhase('done')
    } catch (err) {
      setError(err.message || 'Could not claim reward.')
      setPhase('error')
    }
  }

  const adsWatched = stats?.adsWatchedToday ?? 0
  const remaining = stats?.remainingAdsToday ?? 10
  const earned = stats?.ccEarnedToday ?? 0

  // Cooldown fill percentage
  const cooldownPct = Math.round(((AD_COOLDOWN_SECS - cooldown) / AD_COOLDOWN_SECS) * 100)

  return (
    <div className="rad-container">
      <div className="rad-header">
        <span className="rad-icon">🎬</span>
        <div>
          <h4 className="rad-title">Watch & Earn</h4>
          <p className="rad-desc">Watch a short video and earn 2 CC. Up to 10 per day.</p>
        </div>
      </div>

      {stats && (
        <div className="rad-stats">
          <div className="rad-stat">
            <strong>{adsWatched}</strong>
            <span>Watched</span>
          </div>
          <div className="rad-stat">
            <strong>{remaining}</strong>
            <span>Remaining</span>
          </div>
          <div className="rad-stat">
            <strong>{earned} CC</strong>
            <span>Earned Today</span>
          </div>
        </div>
      )}

      {phase === 'idle' && (
        <button
          className="rad-watch-btn"
          type="button"
          onClick={loadAd}
          disabled={remaining <= 0}
        >
          {remaining <= 0 ? 'Daily Limit Reached' : '▶ Watch Ad & Earn 2 CC'}
        </button>
      )}

      {phase === 'cooldown' && (
        <div className="rad-cooldown">
          <div className="rad-cooldown-ring">
            <svg viewBox="0 0 44 44" className="rad-cooldown-svg">
              <circle cx="22" cy="22" r="18" className="rad-cooldown-track" />
              <circle
                cx="22" cy="22" r="18"
                className="rad-cooldown-fill"
                strokeDasharray={`${(cooldownPct / 100) * 113} 113`}
                strokeDashoffset="28"
              />
            </svg>
            <span className="rad-cooldown-num">{cooldown}</span>
          </div>
          <p className="rad-cooldown-label">Next ad in <strong>{cooldown}s</strong></p>
          <div className="rad-progress-bar">
            <div className="rad-cooldown-bar-fill" style={{ width: `${cooldownPct}%` }} />
          </div>
        </div>
      )}

      {phase === 'loading' && (
        <div className="rad-loading">
          <div className="chat-loading-spinner" />
          <p>Loading ad...</p>
        </div>
      )}

      {phase === 'watching' && ad && (
        <div className="rad-player">
          {ad.videoUrl ? (
            <video
              ref={videoRef}
              src={ad.videoUrl}
              autoPlay
              muted={false}
              playsInline
              className="rad-video"
              onEnded={() => {
                if (progress < 100) {
                  clearInterval(timerRef.current)
                  handleComplete(ad)
                }
              }}
            />
          ) : (
            <div className="rad-placeholder">
              <span>📺</span>
              <p>Ad playing...</p>
            </div>
          )}
          <div className="rad-progress-bar">
            <div className="rad-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="rad-progress-text">{Math.round(progress)}% — Do not close</p>
        </div>
      )}

      {phase === 'completing' && (
        <div className="rad-loading">
          <div className="chat-loading-spinner" />
          <p>Claiming reward...</p>
        </div>
      )}

      {phase === 'done' && reward && (
        <div className="rad-reward">
          <span className="rad-reward-icon">🎉</span>
          <h4>+{reward.amount} CC earned!</h4>
          <p>Your new balance includes this reward.</p>
          {remaining > 1 ? (
            <button
              className="rad-watch-btn"
              type="button"
              onClick={() => { setAd(null); startCooldown() }}
            >
              Watch Another
            </button>
          ) : (
            <button className="rad-watch-btn" type="button" onClick={() => { setPhase('idle'); setAd(null) }}>
              Done
            </button>
          )}
        </div>
      )}

      {(phase === 'error' || error) && (
        <div className="rad-error">
          <p>{error}</p>
          <button className="rad-watch-btn" type="button" onClick={() => { setPhase('idle'); setError('') }}>
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}

export default RewardedAds
