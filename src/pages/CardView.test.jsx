import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import CardView from './CardView.jsx'

// 5.1: api/card-meta.js embeds window.__CARDORA_SSR_CARD__ so the very
// first client paint matches the server-rendered gate with zero flash,
// instead of always showing a generic "Preparing your surprise" spinner.

vi.mock('../lib/api.js', () => ({
  // Never resolves -- keeps the component in its loading state for the
  // whole test, which is exactly the state under test here.
  getCardBySlug: vi.fn(() => new Promise(() => {})),
  submitCardResponse: vi.fn(),
  submitPollVote: vi.fn(),
  submitChainReply: vi.fn(),
  submitTriviaAnswer: vi.fn(),
  sendCardAnonymousMessage: vi.fn(),
  reactToCard: vi.fn(),
}))

function renderAt(slug) {
  return render(
    <MemoryRouter initialEntries={[`/card/${slug}`]}>
      <Routes>
        <Route path="/card/:id" element={<CardView />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CardView — SSR gate handoff', () => {
  afterEach(() => {
    delete window.__CARDORA_SSR_CARD__
  })

  it('renders the embedded sender/title immediately instead of the generic spinner', () => {
    window.__CARDORA_SSR_CARD__ = { slug: 'abc123', senderName: 'Ada', title: 'Happy Birthday!' }

    renderAt('abc123')

    expect(screen.getByText('Ada sent you a card')).toBeInTheDocument()
    expect(screen.getByText('Happy Birthday!')).toBeInTheDocument()
    expect(screen.queryByText('Preparing your surprise')).not.toBeInTheDocument()
  })

  it('falls back to the generic spinner when no SSR data was embedded', () => {
    renderAt('abc123')

    expect(screen.getByText('Preparing your surprise')).toBeInTheDocument()
  })

  it('ignores a stale embed left over from a different card slug', () => {
    window.__CARDORA_SSR_CARD__ = { slug: 'a-different-card', senderName: 'Ada', title: 'Happy Birthday!' }

    renderAt('abc123')

    expect(screen.getByText('Preparing your surprise')).toBeInTheDocument()
    expect(screen.queryByText('Ada sent you a card')).not.toBeInTheDocument()
  })

  it('consumes the global so a later read (e.g. a second mount) never reuses it', () => {
    window.__CARDORA_SSR_CARD__ = { slug: 'abc123', senderName: 'Ada', title: 'Happy Birthday!' }

    renderAt('abc123')

    expect(window.__CARDORA_SSR_CARD__).toBeUndefined()
  })

  it('falls back to "Someone" when the embed has no sender name', () => {
    window.__CARDORA_SSR_CARD__ = { slug: 'abc123', senderName: '', title: 'Happy Birthday!' }

    renderAt('abc123')

    expect(screen.getByText('Someone sent you a card')).toBeInTheDocument()
  })
})
