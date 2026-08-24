import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import QuickCreate from './QuickCreate.jsx'
import { getCardPrices, trackEvent } from '../lib/api.js'
import { generateAnonShareImage, shareOrDownloadAnonImage } from '../lib/anonShareImage.js'

// 6.5: "Send one back" hands off to QuickCreate via
// ?type=personal&replyTo=<slug>&replySender=<name> -- these tests cover the
// reply-context banner, the pre-filled greeting, and the reply-flavoured
// share text on the existing post-send share row (there's no other
// delivery mechanism to build here -- see the commit message).
// 6.8: no account is required to build a card, only to send it -- signed-out
// tests below flip `outletContext.currentUser` to null per-test.

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

vi.mock('../lib/anonShareImage.js', () => ({
  generateAnonShareImage: vi.fn(),
  shareOrDownloadAnonImage: vi.fn(),
}))

const createCardOnBackend = vi.fn(async () => ({ ok: true, data: { slug: 'new-card-1' }, message: 'Card created' }))
const openAuthModal = vi.fn()
let outletContext = { createCardOnBackend, currentUser: { username: 'replier' }, openAuthModal, balance: 100, inventory: [] }

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useOutletContext: () => outletContext,
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

beforeEach(() => {
  outletContext = { createCardOnBackend, currentUser: { username: 'replier' }, openAuthModal, balance: 100, inventory: [] }
  openAuthModal.mockClear()
})

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

// 6.6: "Share to status" on the anonymous-card send-success screen --
// generates a themed image from the just-sent card's own prompt and the
// signed-in sender's username.
describe('QuickCreate — 6.6 anonymous share image', () => {
  afterEach(() => {
    vi.mocked(getCardPrices).mockClear()
    vi.mocked(trackEvent).mockClear()
    vi.mocked(generateAnonShareImage).mockReset()
    vi.mocked(shareOrDownloadAnonImage).mockReset()
    createCardOnBackend.mockClear()
  })

  async function sendAnonymousCard(message) {
    renderAt('/quick?type=anonymous')
    fireEvent.change(screen.getByPlaceholderText('Recipients can reply to this card anonymously…'), { target: { value: message } })
    fireEvent.click(screen.getByRole('button', { name: /Create Card/ }))
    const sendBtn = await screen.findByRole('button', { name: /Send free/i })
    fireEvent.click(sendBtn)
    await waitFor(() => expect(createCardOnBackend).toHaveBeenCalled())
  }

  it('shows a "Share to status" button once the card is sent', async () => {
    await sendAnonymousCard('Ask me anything!')
    expect(await screen.findByRole('button', { name: 'Share to status' })).toBeInTheDocument()
  })

  it('clicking it generates an image from the current prompt, palette, and username', async () => {
    const fakeBlob = new Blob(['fake'], { type: 'image/png' })
    vi.mocked(generateAnonShareImage).mockResolvedValueOnce(fakeBlob)
    vi.mocked(shareOrDownloadAnonImage).mockResolvedValueOnce()
    await sendAnonymousCard('Ask me anything!')

    fireEvent.click(await screen.findByRole('button', { name: 'Share to status' }))

    await waitFor(() => expect(generateAnonShareImage).toHaveBeenCalledWith({
      prompt: 'Ask me anything!',
      username: 'replier',
      colors: { background: '#0b0f12', accent: '#7ef7ff' },
    }))
    await waitFor(() => expect(shareOrDownloadAnonImage).toHaveBeenCalledWith(fakeBlob, 'cardora-ask-replier.png'))
  })

  it('shows an error message if image generation fails, without crashing the page', async () => {
    vi.mocked(generateAnonShareImage).mockRejectedValueOnce(new Error('canvas boom'))
    await sendAnonymousCard('Ask me anything!')

    fireEvent.click(await screen.findByRole('button', { name: 'Share to status' }))

    await waitFor(() => expect(screen.getByText('canvas boom')).toBeInTheDocument())
  })
})

// 6.8: "No account required to build a card. Auth is required at send
// only." -- QuickCreate used to gate the entire page behind a sign-in
// screen, blocking building outright. These prove a signed-out visitor can
// fill out the whole card and only hits auth at the send step, and that
// nothing they typed is lost (AuthModal is an overlay, not a route change,
// so this component never unmounts across that gate).
describe('QuickCreate — 6.8 build without an account', () => {
  afterEach(() => {
    vi.mocked(getCardPrices).mockClear()
    vi.mocked(trackEvent).mockClear()
    createCardOnBackend.mockClear()
  })

  it('renders the builder for a signed-out visitor instead of a sign-in gate', () => {
    outletContext = { ...outletContext, currentUser: null }
    renderAt('/quick?type=personal')

    expect(screen.getByPlaceholderText('Write what you want to say…')).toBeInTheDocument()
    expect(screen.queryByText('Sign in to create a card')).not.toBeInTheDocument()
  })

  it('lets a signed-out visitor fill out the whole card with no auth prompt while typing', () => {
    outletContext = { ...outletContext, currentUser: null }
    renderAt('/quick?type=personal')

    fireEvent.change(screen.getByPlaceholderText('A short, memorable heading…'), { target: { value: 'Happy Birthday!' } })
    fireEvent.change(screen.getByPlaceholderText('Write what you want to say…'), { target: { value: 'Hope your day is great!' } })

    expect(screen.getByDisplayValue('Happy Birthday!')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Hope your day is great!')).toBeInTheDocument()
    expect(openAuthModal).not.toHaveBeenCalled()
  })

  it('opens the auth modal instead of the review step when a signed-out visitor clicks "Create Card", keeping their draft intact', async () => {
    outletContext = { ...outletContext, currentUser: null }
    renderAt('/quick?type=personal')

    fireEvent.change(screen.getByPlaceholderText('A short, memorable heading…'), { target: { value: 'Happy Birthday!' } })
    fireEvent.change(screen.getByPlaceholderText('Write what you want to say…'), { target: { value: 'Hope your day is great!' } })
    fireEvent.click(screen.getByRole('button', { name: /Create Card/ }))

    await waitFor(() => expect(openAuthModal).toHaveBeenCalled())
    expect(createCardOnBackend).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /Send free/i })).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('Hope your day is great!')).toBeInTheDocument()
  })

  it('sends normally once already signed in, with no auth prompt', async () => {
    outletContext = { ...outletContext, currentUser: { username: 'replier' } }
    renderAt('/quick?type=personal')

    fireEvent.change(screen.getByPlaceholderText('A short, memorable heading…'), { target: { value: 'Happy Birthday!' } })
    fireEvent.change(screen.getByPlaceholderText('Write what you want to say…'), { target: { value: 'Hope your day is great!' } })
    fireEvent.click(screen.getByRole('button', { name: /Create Card/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Send free/i }))

    await waitFor(() => expect(createCardOnBackend).toHaveBeenCalled())
    expect(openAuthModal).not.toHaveBeenCalled()
  })
})
