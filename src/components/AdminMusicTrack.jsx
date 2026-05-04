import { useEffect, useRef, useState } from 'react'

function formatSec(seconds) {
  if (!Number.isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// Themed admin music card with playback controls and a dual-thumb trim
// slider. Plays the trimmed segment only when the user hits the loop button —
// the raw audio still plays end-to-end if they hit play, so they can hear
// where to set the bounds.
//
// Modes:
//  - 'draft'   — freshly-uploaded clip awaiting trim+save (full editor).
//  - 'library' — saved track already in the library (read-only; play the
//                trimmed span + delete only). User said: once saved, can't
//                re-edit, only remove.
//  - 'edit'    — legacy editable mode. Kept for compatibility but unused in
//                the music library list now.
export default function AdminMusicTrack({ track, onSave, onDelete, mode = 'library' }) {
  const isDraft = mode === 'draft'
  const isLibrary = mode === 'library'
  const isEditable = !isLibrary  // draft + legacy 'edit'
  const audioRef = useRef(null)
  const [duration, setDuration] = useState(Number(track.duration) || 0)
  const [position, setPosition] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [name, setName] = useState(track.name || track.title || '')
  // Trim points in seconds. Default startSec = 0 and endSec = full duration.
  // Both the field check and the duration fallback handle a track that's
  // never been edited.
  const [startSec, setStartSec] = useState(Number(track.startSec) || 0)
  const [endSec, setEndSec] = useState(
    Number.isFinite(Number(track.endSec)) && Number(track.endSec) > 0
      ? Number(track.endSec)
      : Number(track.duration) || 0,
  )
  // Library mode locks playback to the saved span — that's the whole point.
  // Editable modes default to false so admins can hear the full clip while trimming.
  const [trimMode, setTrimMode] = useState(mode === 'library')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Mark dirty when name or trim points diverge from the saved record. Drafts
  // are always dirty until the first save lands — there's nothing in the
  // backend yet to compare against.
  useEffect(() => {
    if (isDraft) {
      setDirty(true)
      return
    }
    const same =
      name === (track.name || track.title || '') &&
      Math.abs(startSec - (Number(track.startSec) || 0)) < 0.05 &&
      Math.abs(endSec - (Number(track.endSec) || duration || 0)) < 0.05
    setDirty(!same)
  }, [name, startSec, endSec, duration, track, isDraft])

  const handleLoaded = () => {
    const d = audioRef.current?.duration || 0
    setDuration(d)
    if (!Number.isFinite(Number(track.endSec)) || Number(track.endSec) <= 0) {
      setEndSec(d)
    }
  }

  const handleTimeUpdate = () => {
    const t = audioRef.current?.currentTime || 0
    setPosition(t)
    // When trim mode is on, loop the segment.
    if (trimMode && audioRef.current && endSec > 0 && t >= endSec) {
      audioRef.current.currentTime = startSec
    }
  }

  const togglePlay = () => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      if (trimMode && (el.currentTime < startSec || el.currentTime >= endSec)) {
        el.currentTime = startSec
      }
      el.play()
      setPlaying(true)
    } else {
      el.pause()
      setPlaying(false)
    }
  }

  const handleScrub = (e) => {
    const t = Number(e.target.value)
    if (audioRef.current) audioRef.current.currentTime = t
    setPosition(t)
  }

  const handleSave = async () => {
    if (!onSave) return
    setSaving(true)
    try {
      await onSave({
        ...track,                                  // keeps `file` (raw blob) for trim+upload
        name,
        startSec: Number(startSec.toFixed(2)),
        endSec: Number(endSec.toFixed(2)),
        duration: Number(duration.toFixed(2)),
      })
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  // Visual % positions of the two trim thumbs along the timeline.
  const startPct = duration > 0 ? Math.min(100, (startSec / duration) * 100) : 0
  const endPct = duration > 0 ? Math.min(100, (endSec / duration) * 100) : 100
  const positionPct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0

  return (
    <div className="amt-card">
      <audio
        ref={audioRef}
        src={track.url || track.audioUrl}
        onLoadedMetadata={handleLoaded}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setPlaying(false)}
        preload="metadata"
      />

      <div className="amt-head">
        <div className="amt-icon" aria-hidden="true">♫</div>
        {isEditable ? (
          <input
            className="amt-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Track name"
          />
        ) : (
          <div className="amt-name-display" title={name}>{name || 'Untitled track'}</div>
        )}
        <button
          type="button"
          className="amt-delete"
          onClick={() => onDelete?.(track)}
          aria-label="Delete track"
          title="Delete track"
        >
          ✕
        </button>
      </div>

      <div className="amt-controls">
        <button
          type="button"
          className="amt-play"
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <svg viewBox="0 0 16 16" width="14" height="14"><rect x="3" y="2" width="3.5" height="12" /><rect x="9.5" y="2" width="3.5" height="12" /></svg>
          ) : (
            <svg viewBox="0 0 16 16" width="14" height="14"><path d="M3 2 L13 8 L3 14 Z" /></svg>
          )}
        </button>

        <div className="amt-timeline">
          <div className="amt-timeline-bar">
            <div
              className="amt-timeline-active"
              style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
            />
            <div className="amt-timeline-pos" style={{ left: `${positionPct}%` }} />
          </div>
          <input
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={position}
            onChange={handleScrub}
            className="amt-scrub"
            aria-label="Scrub"
          />
        </div>

        <span className="amt-time">{formatSec(position)} / {formatSec(duration)}</span>
      </div>

      {isEditable ? (
        <>
          <div className="amt-trim">
            <div className="amt-trim-head">
              <span className="amt-trim-label">Play span</span>
              <button
                type="button"
                className={`amt-trim-toggle ${trimMode ? 'on' : ''}`}
                onClick={() => setTrimMode((v) => !v)}
                title="Loop only the selected span"
              >
                {trimMode ? 'Looping span' : 'Loop span'}
              </button>
            </div>

            <div className="amt-trim-grid">
              <label className="amt-trim-field">
                <span>Start</span>
                <input
                  type="range"
                  min="0"
                  max={Math.max(0, endSec - 0.5) || 0}
                  step="0.1"
                  value={startSec}
                  onChange={(e) => setStartSec(Number(e.target.value))}
                />
                <em>{formatSec(startSec)}</em>
              </label>
              <label className="amt-trim-field">
                <span>End</span>
                <input
                  type="range"
                  min={Math.min(duration, startSec + 0.5)}
                  max={duration || 0}
                  step="0.1"
                  value={endSec}
                  onChange={(e) => setEndSec(Number(e.target.value))}
                />
                <em>{formatSec(endSec)}</em>
              </label>
            </div>
          </div>

          <div className="amt-actions">
            <span className="amt-status">
              {isDraft
                ? 'Trim and name your clip, then save it to the library.'
                : dirty
                ? 'Unsaved changes'
                : 'Saved'}
            </span>
            <button
              type="button"
              className="amt-save"
              onClick={handleSave}
              disabled={!dirty || saving || !name.trim()}
            >
              {saving
                ? (isDraft ? 'Adding…' : 'Saving…')
                : (isDraft ? 'Save to library' : 'Save')}
            </button>
          </div>
        </>
      ) : (
        // Library view: read-only span summary, no edit affordances. The only
        // way to change a saved clip is delete + re-upload.
        <div className="amt-library-info">
          <span className="amt-library-span">
            <span className="amt-library-label">Saved span</span>
            <span className="amt-library-value">{formatSec(startSec)} → {formatSec(endSec)}</span>
            <span className="amt-library-len">({formatSec(Math.max(0, endSec - startSec))})</span>
          </span>
          <span className="amt-library-locked" title="Saved tracks can be deleted but not re-edited">🔒 Locked</span>
        </div>
      )}
    </div>
  )
}
