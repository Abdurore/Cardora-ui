import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

function Dropdown({ value, onChange, options, placeholder = 'Select…', disabled = false, className = '', usePortal = false, searchable = false, searchPlaceholder = 'Search…' }) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, minWidth: 0 })
  const [query, setQuery] = useState('')
  const wrapRef = useRef(null)
  const triggerRef = useRef(null)
  const searchRef = useRef(null)

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return
    const handleClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        if (e.target.closest('#dropdown-portal-menu')) return
        setOpen(false)
      }
    }
    const handleKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  // Compute portal position when opening
  useEffect(() => {
    if (open && usePortal && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      const direction = className.includes('cs-toolbar-dropdown') ? 'down' : 'up'
      if (direction === 'up') {
        setMenuPos({
          bottom: window.innerHeight - r.top + 8,
          left: Math.max(8, r.left),
          minWidth: r.width,
        })
      } else {
        setMenuPos({
          top: r.bottom + 8,
          left: Math.max(8, r.left),
          minWidth: r.width,
        })
      }
    }
  }, [open, usePortal, className])

  const selected = options.find((o) => o.value === value)

  const handleSelect = (val) => {
    setOpen(false)
    setQuery('')
    onChange(val)
  }

  // Focus the search box the moment the menu mounts so typing works immediately.
  useEffect(() => {
    if (open && searchable) searchRef.current?.focus()
    if (!open) setQuery('')
  }, [open, searchable])

  const filteredOptions = searchable && query.trim()
    ? options.filter((opt) => opt.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  const menu = open ? (
    <ul
      id="dropdown-portal-menu"
      className={`dropdown-menu${usePortal ? ' cs-dropdown-portal-menu' : ''}${searchable ? ' searchable' : ''}`}
      role="listbox"
      style={usePortal ? {
        position: 'fixed',
        ...(menuPos.bottom ? { bottom: menuPos.bottom } : { top: menuPos.top }),
        left: menuPos.left,
        minWidth: menuPos.minWidth,
        zIndex: 999999,
      } : undefined}
    >
      {searchable && (
        <li className="dropdown-search-row" onMouseDown={(e) => e.stopPropagation()}>
          <input
            ref={searchRef}
            type="text"
            className="dropdown-search-input"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </li>
      )}
      {filteredOptions.map((opt) => (
        <li
          key={opt.value}
          role="option"
          aria-selected={opt.value === value}
          className={`dropdown-option${opt.value === value ? ' selected' : ''}`}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleSelect(opt.value) }}
          onTouchEnd={(e) => { e.preventDefault(); handleSelect(opt.value) }}
        >
          {opt.label}
        </li>
      ))}
      {searchable && filteredOptions.length === 0 && (
        <li className="dropdown-empty">No matches</li>
      )}
    </ul>
  ) : null

  return (
    <div ref={wrapRef} className={`dropdown${open ? ' open' : ''}${disabled ? ' disabled' : ''} ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className="dropdown-trigger"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`dropdown-value${selected ? '' : ' placeholder'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className="dropdown-chevron" viewBox="0 0 12 8" aria-hidden="true">
          <path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {usePortal ? createPortal(menu, document.body) : menu}
    </div>
  )
}

export default Dropdown
