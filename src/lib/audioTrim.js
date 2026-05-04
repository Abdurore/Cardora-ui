// Trim an audio file to [startSec, endSec] entirely in the browser using
// Web Audio API + a hand-rolled WAV encoder. Returns a new File (audio/wav)
// that contains ONLY the trimmed segment — useful when uploading to a
// service that should store the final clip, not the raw original.
//
// The browser can decode mp3/m4a/wav/ogg/etc via decodeAudioData, but it
// can't re-encode to mp3 without a heavy library. WAV (PCM 16-bit) is
// universal, lossless, and trivially small for a sub-minute card music clip.

export async function trimAudioFile(file, startSec, endSec) {
  if (!(file instanceof Blob)) throw new Error('trimAudioFile: file is required')
  const start = Math.max(0, Number(startSec) || 0)
  const end   = Math.max(start + 0.05, Number(endSec) || 0)

  const arrayBuffer = await file.arrayBuffer()
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) throw new Error('Audio API not supported in this browser')
  const tmpCtx = new AudioCtx()
  const decoded = await tmpCtx.decodeAudioData(arrayBuffer.slice(0))
  await tmpCtx.close().catch(() => {})

  const sampleRate = decoded.sampleRate
  const numChannels = Math.min(2, decoded.numberOfChannels) // stereo cap
  const startSample = Math.floor(start * sampleRate)
  const endSample   = Math.min(decoded.length, Math.floor(end * sampleRate))
  const length      = Math.max(1, endSample - startSample)

  // Copy the trimmed range out into per-channel Float32 arrays. Going through
  // an OfflineAudioContext would also work but is slower for a simple slice.
  const channels = []
  for (let ch = 0; ch < numChannels; ch++) {
    const src = decoded.getChannelData(ch)
    channels.push(src.subarray(startSample, startSample + length))
  }

  const wavBlob = encodeWav(channels, sampleRate)
  const baseName = (file.name || 'audio').replace(/\.[^.]+$/, '') || 'audio'
  return new File([wavBlob], `${baseName}-trim.wav`, { type: 'audio/wav' })
}

// Standard PCM 16-bit WAV. Channels arrive interleaved by frame.
function encodeWav(channels, sampleRate) {
  const numChannels = channels.length
  const numFrames   = channels[0].length
  const bytesPerSample = 2
  const blockAlign  = numChannels * bytesPerSample
  const byteRate    = sampleRate * blockAlign
  const dataSize    = numFrames * blockAlign
  const buffer      = new ArrayBuffer(44 + dataSize)
  const view        = new DataView(buffer)

  // RIFF header
  writeString(view, 0,  'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8,  'WAVE')
  // fmt chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)            // PCM chunk size
  view.setUint16(20, 1, true)             // format = PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bytesPerSample * 8, true)
  // data chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // Interleave + clamp to 16-bit signed range
  let offset = 44
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channels[ch][i]
      if (sample > 1)  sample = 1
      if (sample < -1) sample = -1
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
}

// Decode just enough metadata to learn the duration of an arbitrary file.
// Used in the draft editor before any trim happens, so the timeline shows
// the right total length immediately.
export async function getAudioDuration(file) {
  const arrayBuffer = await file.arrayBuffer()
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return 0
  const ctx = new AudioCtx()
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0))
    return decoded.duration
  } finally {
    await ctx.close().catch(() => {})
  }
}
