import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CardDetailModal from './CardDetailModal.jsx'

// Explore/Marketplace consolidation: a priced template must never be
// "used" without either (a) going through the unlock-confirm step, or
// (b) already being unlocked from a prior purchase. Once unlocked, using
// it again must never call onUnlockTemplate a second time.

function lockedCard(overrides = {}) {
  return {
    id: 'tmpl-1',
    templateId: 'tmpl-1',
    title: 'Founder Birthday Card',
    type: 'personal',
    tier: 'classic',
    price: 8,
    isUnlocked: false,
    layoutConfig: { content: { heading: 'Hi' } },
    ...overrides,
  }
}

function renderModal(props) {
  return render(
    <MemoryRouter>
      <CardDetailModal
        card={lockedCard()}
        onClose={() => {}}
        onTemplateUse={() => {}}
        currentUser={{ id: 'buyer_1' }}
        balance={20}
        {...props}
      />
    </MemoryRouter>,
  )
}

describe('CardDetailModal — unlock gating', () => {
  it('a locked priced template shows an Unlock step, not an immediate Use', () => {
    renderModal({})
    fireEvent.click(screen.getByRole('button', { name: /Unlock — 8 CC/i }))
    expect(screen.getByText('Unlock this template')).toBeInTheDocument()
  })

  it('confirming unlock calls onUnlockTemplate exactly once, then proceeds', async () => {
    const onUnlockTemplate = vi.fn().mockResolvedValue({ ok: true })
    const onTemplateUse = vi.fn()
    renderModal({ onUnlockTemplate, onTemplateUse })

    fireEvent.click(screen.getByRole('button', { name: /Unlock — 8 CC/i }))
    fireEvent.click(screen.getByRole('button', { name: /Unlock — 8 CC/i }))

    await waitFor(() => expect(onTemplateUse).toHaveBeenCalledTimes(1))
    expect(onUnlockTemplate).toHaveBeenCalledTimes(1)
    expect(onUnlockTemplate).toHaveBeenCalledWith('tmpl-1')
  })

  it('an already-unlocked template uses immediately and never calls onUnlockTemplate', async () => {
    const onUnlockTemplate = vi.fn()
    const onTemplateUse = vi.fn()
    renderModal({
      card: lockedCard({ isUnlocked: true }),
      onUnlockTemplate,
      onTemplateUse,
    })

    fireEvent.click(screen.getByRole('button', { name: /Use Template/i }))

    await waitFor(() => expect(onTemplateUse).toHaveBeenCalledTimes(1))
    expect(onUnlockTemplate).not.toHaveBeenCalled()
    expect(screen.queryByText('Unlock this template')).not.toBeInTheDocument()
  })

  it('insufficient balance shows the real error and a route to the CC store, without silently failing', async () => {
    const onUnlockTemplate = vi.fn().mockResolvedValue({ ok: false, message: 'Not enough CC. 8 required.' })
    renderModal({ onUnlockTemplate, balance: 5 })

    fireEvent.click(screen.getByRole('button', { name: /Unlock — 8 CC/i }))
    fireEvent.click(screen.getByRole('button', { name: /Unlock — 8 CC/i }))

    await waitFor(() => expect(screen.getByText('Not enough CC. 8 required.')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Get more CC/i })).toBeInTheDocument()
  })

  it('a free template uses immediately with no unlock step at all', async () => {
    const onUnlockTemplate = vi.fn()
    const onTemplateUse = vi.fn()
    renderModal({
      card: lockedCard({ price: 0, isUnlocked: true }),
      onUnlockTemplate,
      onTemplateUse,
    })

    expect(screen.queryByText(/Unlock ·/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Use Template/i }))

    await waitFor(() => expect(onTemplateUse).toHaveBeenCalledTimes(1))
    expect(onUnlockTemplate).not.toHaveBeenCalled()
  })
})
