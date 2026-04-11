import { useEffect, useRef, useState } from 'react'

const PRESET_SWATCHES = [
  '#ffffff', '#eafcff', '#c9f7ff', '#7ef7ff', '#5ce7f2', '#62ffa2', '#9ef6cf',
  '#ff9bd2', '#ffd166', '#ffad5c', '#ff6b6b', '#c77dff', '#7c5cff', '#4361ee',
  '#1b9aaa', '#0b132b', '#1a1f2c', '#2a2f3a', '#555b66', '#8d99ae', '#000000',
]

function ColorPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const emit = (hex) => {
    onChange({ target: { value: hex } })
  }

  return (
    <div ref={ref} className={`color-picker ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="color-picker-swatch"
        style={{ background: value }}
        onClick={() => setOpen((v) => !v)}
        aria-label="Pick color"
      />
      {open && (
        <div className="color-picker-panel">
          <div className="color-picker-grid">
            {PRESET_SWATCHES.map((hex) => (
              <button
                key={hex}
                type="button"
                className={`color-picker-chip ${hex.toLowerCase() === (value || '').toLowerCase() ? 'selected' : ''}`}
                style={{ background: hex }}
                onClick={() => {
                  emit(hex)
                  setOpen(false)
                }}
                aria-label={hex}
              />
            ))}
          </div>
          <div className="color-picker-custom">
            <label>
              <span>Custom</span>
              <input
                type="color"
                value={value || '#ffffff'}
                onChange={(e) => emit(e.target.value)}
              />
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => emit(e.target.value)}
              className="color-picker-hex"
              maxLength={7}
              placeholder="#ffffff"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default ColorPicker
