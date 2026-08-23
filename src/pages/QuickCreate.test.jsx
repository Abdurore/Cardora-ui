import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import QuickCreate from './QuickCreate.jsx'
import { getCardPrices, trackEvent } from '../lib/api.js'

// 6.5: "Send one back" hands off to QuickCreate via
// ?type=personal&replyTo=<slug>&replySender=<name> -- these tests cover the
// reply-context banner, the pre-filled greeting, and the reply-flavoured
// share text on the existing post-send share row (there's no other
// delivery mechanism to build here -- see the commit message).

vi.mock('../lib/api.js', () => ({
  getCardPrices: vi.fn(async () => ({})),
  getTemplateById: vi.fn(),
  getMyCard: vi.fn(),
  trackEvent: vi.fn(async () => {}),
  createReminder: vi.fn(),
  attachGiftToCard: vi.fn(),
}))

vi.mock('../lib/cloudinary.js', () => ({
  uploadToCloudinary: vi.fn(),
}))

const createCardOnBackend = vi.fn(async () => ({ ok: true, data: { slug: 'new-card-1' }, message: 'Card created' }))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useOutletContext: () => ({
      createCardOnBackend,
      currentUser: { username: 'replier' },
      openAuthModal: vi.fn(),
      balance: 100,
      inventory: [],
    }),
  }
})

function renderAt(url) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/quick" element={<QuickCreate />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('QuickCreate — 6.5 reply context', () => {
  afterEach(() => {
    vi.mocked(getCardPrices).mockClear()
    vi.mocked(trackEvent).mockClear()
    createCardOnBackend.mockClear()
  })

  it('shows a "Replying to" banner when replyTo/replySender are present', () => {
    renderAt('/quick?type=personal&replyTo=abc123&replySender=Ada')
    expect(screen.getByText('↩ Replying to Ada')).toBeInTheDocument()
  })

  it('shows a generic fallback banner when replySender is missing', () => {
    renderAt('/quick?type=personal&replyTo=abc123')
    expect(screen.getByText('↩ Replying to their card')).toBeInTheDocument()
  })

  it('shows no banner at all for a normal (non-reply) personal card', () => {
    renderAt('/quick?type=personal')
    expect(screen.queryByText(/Replying to/)).not.toBeInTheDocument()
  })

  it('pre-fills the heading with a reply greeting naming the sender', () => {
    renderAt('/quick?type=personal&replyTo=abc123&replySender=Ada')
    expect(screen.getByDisplayValue('Right back at you, Ada!')).toBeInTheDocument()
  })

  it('falls back to a nameless greeting when replySender is missing', () => {
    renderAt('/quick?type=personal&replyTo=abc123')
    expect(screen.getByDisplayValue('Right back at you!')).toBeInTheDocument()
  })

  it('sends reply-flavoured share text on the post-send share row, not the generic message', async () => {
    renderAt('/quick?type=personal&replyTo=abc123&replySender=Ada')

    fireEvent.change(screen.getByPlaceholderText('Write what you want to say…'), { target: { value: 'Thanks for the card!' } })
    fireEvent.click(screen.getByRole('button', { name: /Create Card/ }))

    const sendBtn = await screen.findByRole('button', { name: /Send free/i })
    fireEvent.click(sendBtn)

    await waitFor(() => expect(createCardOnBackend).toHaveBeenCalled())
    const whatsappLink = await screen.findByRole('link', { name: /WhatsApp/i })
    expect(decodeURIComponent(whatsappLink.getAttribute('href'))).toContain('Sending one back to you, Ada!')
  })
})
