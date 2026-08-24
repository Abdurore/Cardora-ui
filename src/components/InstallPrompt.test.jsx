import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import InstallPrompt from './InstallPrompt.jsx'

// 6.8: "Prompt install after first successful send." Only mounted from a
// send-success screen, so its own visibility logic just needs to handle
// canInstall + the one-time-ever localStorage flag correctly.

const STORAGE_KEY = 'cardora-install-prompt-shown'

describe('InstallPrompt', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY)
  })

  it('renders nothing when the browser has not offered an install prompt', () => {
    render(<InstallPrompt canInstall={false} promptInstall={vi.fn()} />)
    expect(screen.queryByText('Add Cardora to your home screen')).not.toBeInTheDocument()
  })

  it('shows the banner when canInstall is true and marks it shown', () => {
    render(<InstallPrompt canInstall={true} promptInstall={vi.fn()} />)
    expect(screen.getByText('Add Cardora to your home screen')).toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1')
  })

  it('does not show again once already shown once, even with canInstall true', () => {
    localStorage.setItem(STORAGE_KEY, '1')
    render(<InstallPrompt canInstall={true} promptInstall={vi.fn()} />)
    expect(screen.queryByText('Add Cardora to your home screen')).not.toBeInTheDocument()
  })

  it('clicking Install calls promptInstall and shows an installing state on acceptance', async () => {
    const promptInstall = vi.fn().mockResolvedValue({ outcome: 'accepted' })
    render(<InstallPrompt canInstall={true} promptInstall={promptInstall} />)

    fireEvent.click(screen.getByRole('button', { name: 'Install' }))

    await waitFor(() => expect(promptInstall).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('Installing Cardora…')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument()
  })

  it('hides the banner when the browser prompt is dismissed', async () => {
    const promptInstall = vi.fn().mockResolvedValue({ outcome: 'dismissed' })
    render(<InstallPrompt canInstall={true} promptInstall={promptInstall} />)

    fireEvent.click(screen.getByRole('button', { name: 'Install' }))

    await waitFor(() => expect(screen.queryByText('Add Cardora to your home screen')).not.toBeInTheDocument())
  })

  it('clicking "Not now" hides the banner without calling promptInstall', () => {
    const promptInstall = vi.fn()
    render(<InstallPrompt canInstall={true} promptInstall={promptInstall} />)

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))

    expect(screen.queryByText('Add Cardora to your home screen')).not.toBeInTheDocument()
    expect(promptInstall).not.toHaveBeenCalled()
  })
})
