import { useEffect, useRef, useState } from 'react'

const MAX_DURATION_SEC = 60

function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * A minimal record → stop → preview/re-record control built on MediaRecorder.
 * Hands the caller a Blob (never uploads itself — the parent decides when,
 * matching the existing "pick locally, upload on submit" pattern used for
 * image attachments elsewhere in the app).
 */
function VoiceRecorder({ onChange, accentColor = '#7ef7ff', disabled = false }) {
  const [status, setStatus] = useState('idle') // idle | recording | recorded
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startRecording = async () => {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice recording is not supported in this browser.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
        setStatus('recorded')
        onChange?.({ blob, duration: elapsed })
        stream.getTracks().forEach(t => t.stop())
      }
      recorderRef.current = recorder
      recorder.start()
      setStatus('recording')
      setElapsed(0)
      timerRef.current = setInterval(() => {
        setElapsed(prev => {
          const next = prev + 1
          if (next >= MAX_DURATION_SEC) stopRecording()
          return next
        })
      }, 1000)
    } catch {
      setError('Microphone access was denied or unavailable.')
    }
  }

  const stopRecording = () => {
    clearInterval(timerRef.current)
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }

  const reRecord = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl('')
    setStatus('idle')
    setElapsed(0)
    onChange?.(null)
  }

  if (status === 'recorded') {
    return (
      <div className="voice-recorder voice-recorder-recorded">
        <audio src={previewUrl} controls style={{ height: 34, flex: 1 }} />
        <button type="button" className="voice-recorder-rerecord" onClick={reRecord} disabled={disabled}>
          Re-record
        </button>
      </div>
    )
  }

  return (
    <div className="voice-recorder">
      <button
        type="button"
        className={`voice-recorder-btn ${status === 'recording' ? 'recording' : ''}`}
        style={{ '--voice-accent': accentColor }}
        onClick={status === 'recording' ? stopRecording : startRecording}
        disabled={disabled}
      >
        <span className="voice-recorder-dot" aria-hidden="true" />
        {status === 'recording' ? `Stop · ${formatTime(elapsed)}` : 'Record a voice note'}
      </button>
      {status === 'recording' && (
        <span className="voice-recorder-hint">Up to {formatTime(MAX_DURATION_SEC)}</span>
      )}
      {error && <p className="voice-recorder-error">{error}</p>}
    </div>
  )
}

export default VoiceRecorder
