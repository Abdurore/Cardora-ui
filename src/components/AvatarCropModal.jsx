import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const MIN_SIZE = 24

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function AvatarCropModal({ open, src, onCancel, onSave }) {
  const imgRef = useRef(null)
  const wrapRef = useRef(null)
  const [crop, setCrop] = useState(null)
  const [action, setAction] = useState(null)

  useEffect(() => {
    if (!open) return
    setCrop(null)
    setAction(null)
  }, [open, src])

  useEffect(() => {
    if (!action) return undefined

    const handleMove = (event) => {
      const rect = wrapRef.current.getBoundingClientRect()
      const clientX = event.touches ? event.touches[0].clientX : event.clientX
      const clientY = event.touches ? event.touches[0].clientY : event.clientY
      const x = clamp(clientX - rect.left, 0, rect.width)
      const y = clamp(clientY - rect.top, 0, rect.height)

      if (action.type === 'new') {
        const start = action.start
        const newX = Math.min(start.x, x)
        const newY = Math.min(start.y, y)
        const w = Math.abs(x - start.x)
        const h = Math.abs(y - start.y)
        setCrop({ x: newX, y: newY, w, h })
        return
      }

      if (!crop) return

      if (action.type === 'move') {
        const dx = x - action.start.x
        const dy = y - action.start.y
        const nextX = clamp(action.initial.x + dx, 0, rect.width - crop.w)
        const nextY = clamp(action.initial.y + dy, 0, rect.height - crop.h)
        setCrop({ ...crop, x: nextX, y: nextY })
        return
      }

      if (action.type === 'resize') {
        const { handle } = action
        const startCrop = action.initial
        let next = { ...startCrop }

        if (handle.includes('e')) {
          next.w = clamp(x - startCrop.x, MIN_SIZE, rect.width - startCrop.x)
        }
        if (handle.includes('s')) {
          next.h = clamp(y - startCrop.y, MIN_SIZE, rect.height - startCrop.y)
        }
        if (handle.includes('w')) {
          const newX = clamp(x, 0, startCrop.x + startCrop.w - MIN_SIZE)
          next.w = startCrop.x + startCrop.w - newX
          next.x = newX
        }
        if (handle.includes('n')) {
          const newY = clamp(y, 0, startCrop.y + startCrop.h - MIN_SIZE)
          next.h = startCrop.y + startCrop.h - newY
          next.y = newY
        }

        setCrop(next)
      }
    }

    const handleUp = () => setAction(null)

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    window.addEventListener('touchmove', handleMove)
    window.addEventListener('touchend', handleUp)

    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('touchend', handleUp)
    }
  }, [action, crop])

  if (!open || !src) return null

  const beginNewCrop = (event) => {
    const rect = wrapRef.current.getBoundingClientRect()
    const clientX = event.touches ? event.touches[0].clientX : event.clientX
    const clientY = event.touches ? event.touches[0].clientY : event.clientY
    const x = clamp(clientX - rect.left, 0, rect.width)
    const y = clamp(clientY - rect.top, 0, rect.height)
    setAction({ type: 'new', start: { x, y } })
    setCrop({ x, y, w: 0, h: 0 })
  }

  const beginMove = (event) => {
    event.stopPropagation()
    const rect = wrapRef.current.getBoundingClientRect()
    const clientX = event.touches ? event.touches[0].clientX : event.clientX
    const clientY = event.touches ? event.touches[0].clientY : event.clientY
    const x = clamp(clientX - rect.left, 0, rect.width)
    const y = clamp(clientY - rect.top, 0, rect.height)
    setAction({ type: 'move', start: { x, y }, initial: { ...crop } })
  }

  const beginResize = (event, handle) => {
    event.stopPropagation()
    setAction({ type: 'resize', handle, initial: { ...crop } })
  }

  const handleSave = () => {
    const img = imgRef.current
    const wrap = wrapRef.current
    if (!img || !wrap) return

    const rect = wrap.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    const scaleX = img.naturalWidth / rect.width
    const scaleY = img.naturalHeight / rect.height
    const cropRect =
      crop && crop.w > 8 && crop.h > 8
        ? crop
        : { x: 0, y: 0, w: rect.width, h: rect.height }

    const sourceWidth = Math.max(1, Math.round(cropRect.w * scaleX))
    const sourceHeight = Math.max(1, Math.round(cropRect.h * scaleY))
    const maxEdge = 320
    const outputScale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight))

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(sourceWidth * outputScale))
    canvas.height = Math.max(1, Math.round(sourceHeight * outputScale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(
      img,
      cropRect.x * scaleX,
      cropRect.y * scaleY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    )
    onSave(canvas.toDataURL('image/jpeg', 0.84))
  }

  return createPortal(
    <section className="crop-modal" role="dialog" aria-modal="true">
      <div className="crop-backdrop" onClick={onCancel} />
      <div className="crop-card">
        <h3>Crop your avatar</h3>
        <p className="crop-hint">Drag to draw a crop area. Resize using the handles.</p>
        <div
          className="crop-preview"
          ref={wrapRef}
          onMouseDown={beginNewCrop}
          onTouchStart={beginNewCrop}
        >
          <img ref={imgRef} src={src} alt="" className="crop-image" />
          {crop ? (
            <div
              className="crop-rect"
              style={{
                left: `${crop.x}px`,
                top: `${crop.y}px`,
                width: `${crop.w}px`,
                height: `${crop.h}px`,
              }}
              onMouseDown={beginMove}
              onTouchStart={beginMove}
            >
              {['nw', 'ne', 'sw', 'se'].map((handle) => (
                <span
                  key={handle}
                  className={`crop-handle ${handle}`}
                  onMouseDown={(event) => beginResize(event, handle)}
                  onTouchStart={(event) => beginResize(event, handle)}
                />
              ))}
            </div>
          ) : null}
        </div>
        <div className="detail-actions">
          <button className="primary" type="button" onClick={handleSave}>
            Use Crop
          </button>
          <button className="ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </section>,
    document.body,
  )
}

export default AvatarCropModal

