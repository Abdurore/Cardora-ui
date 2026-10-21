import { describe, it, expect, beforeEach, vi } from 'vitest'
import { applyTheme, resolveTheme, storeTheme, getStoredTheme } from './theme.js'

function mockDevice(light) {
  window.matchMedia = vi.fn(() => ({ matches: light, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
}

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.dataset.theme = ''
    document.head.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove())
  })

  it('follows the device when the user never chose', () => {
    mockDevice(true)
    expect(resolveTheme()).toBe('light')
    mockDevice(false)
    expect(resolveTheme()).toBe('dark')
  })

  it('resolving and applying the theme never persists it as a choice', () => {
    // Persisting the OS theme on load locked it in: a device that later
    // switched OS theme stayed on the old one forever.
    mockDevice(true)
    applyTheme(resolveTheme())
    expect(getStoredTheme()).toBe(null)
  })

  it('an explicit choice wins over the device', () => {
    mockDevice(true)
    storeTheme('dark')
    expect(resolveTheme()).toBe('dark')
  })

  it('applyTheme stamps data-theme and the browser-bar colour', () => {
    applyTheme('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.querySelector('meta[name="theme-color"]').content).toBe('#f4f8fb')
    applyTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('')
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1)
    expect(document.querySelector('meta[name="theme-color"]').content).toBe('#0b0f12')
  })
})
