import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import WelcomeBackBanner from './WelcomeBackBanner.jsx'

// "Welcome back" means back after a while, and never over a card being
// opened or composed. It used to greet every logged-in user once per
// browser session, on whatever page they landed on.

const DAY = 24 * 60 * 60 * 1000
const user = { id: 'u1', username: 'ada' }

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <WelcomeBackBanner currentUser={user} />
    </MemoryRouter>,
  )
}

describe('WelcomeBackBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    sessionStorage.clear()
  })
  afterEach(() => vi.useRealTimers())

  it('shows after a multi-day absence', () => {
    localStorage.setItem('cardora:lastActive', String(Date.now() - 5 * DAY))
    renderAt('/')
    act(() => { vi.advanceTimersByTime(2500) })
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('stays hidden for a user who was here recently', () => {
    localStorage.setItem('cardora:lastActive', String(Date.now() - 2 * 60 * 60 * 1000))
    renderAt('/')
    act(() => { vi.advanceTimersByTime(2500) })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it.each(['/studio', '/quick', '/card/abc123'])('never covers %s', (path) => {
    localStorage.setItem('cardora:lastActive', String(Date.now() - 5 * DAY))
    renderAt(path)
    act(() => { vi.advanceTimersByTime(2500) })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
