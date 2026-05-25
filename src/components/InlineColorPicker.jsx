import { useState, useRef, useEffect } from 'react'
import { HexColorPicker } from 'react-colorful'

export default function InlineColorPicker({ value = '#ffffff', onChange, presets = [], label }) {
  const [open, setOpen] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [hex, setHex] = useState(value)
  const wrapRef = useRef(null)

  useEffect(() => { setHex(value) }, [value])

  useEffect(() => {
    if (!open) return
    const close = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  const commit = v => { onChange({ target: { value: v } }); setHex(v) }
  const tryHex = v => { if (/^#[0-9a-fA-F]{6}$/i.test(v)) { commit(v) } }

  return (
    <div className="icp-wrap" ref={wrapRef}>
      <button type="button" className="icp-swatch" style={{ background: value }} onClick={() => setOpen(v => !v)} title={label || 'Pick color'} />
      {label && <span className="icp-label">{label}</span>}
      {open && (
        <div className="icp-popover">
          {presets.length > 0 && (
            <div className="icp-presets">
              {presets.map((p, i) => (
                <button key={i} type="button" className={`icp-preset${p === value ? ' active' : ''}`} style={{ background: p }}
                  onClick={() => { commit(p) }} />
              ))}
            </div>
          )}
          <div className="icp-hex-row">
            <input
              className="icp-hex-input"
              value={hex}
              onChange={e => setHex(e.target.value)}
              onBlur={e => tryHex(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') tryHex(hex) }}
              maxLength={7}
              spellCheck={false}
            />
            <button type="button" className="icp-more-btn" onClick={() => setShowAdvanced(v => !v)} title="Advanced picker">
              {showAdvanced ? '⊖' : '⊕'}
            </button>
          </div>
          {showAdvanced && (
            <div className="icp-advanced">
              <HexColorPicker color={value} onChange={commit} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
