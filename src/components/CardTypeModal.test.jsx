import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CardTypeModal from './CardTypeModal.jsx'

// 6.1: "Remove the fork. Everyone lands in the simple path. Templates are
// step zero." No more "How do you want to build?" -- a personal (or no)
// preselect goes straight to an occasion/template grid; anything else
// skips straight into the simple editor with zero intermediate screens.

const navigateSpy = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => navigateSpy }
})

vi.mock('../lib/api.js', () => ({ trackEvent: vi.fn() }))

function template(overrides = {}) {
  const id = overrides.id || 'tmpl-1'
  return {
    id, templateId: id, title: 'Birthday Card', category: 'birthday',
    type: 'personal', price: 0, isUnlocked: true, status: 'approved',
    ...overrides,
  }
}

function renderModal(props = {}) {
  return render(
    <MemoryRouter>
      <CardTypeModal open onClose={() => {}} currentUser={{ id: 'u1', role: 'user' }} {...props} />
    </MemoryRouter>,
  )
}

describe('CardTypeModal — step zero', () => {
  beforeEach(() => {
    navigateSpy.mockClear()
  })

  it('shows the occasion grid and secondary types by default, not a Quick-vs-Studio fork', () => {
    renderModal()

    expect(screen.getByText('Birthday')).toBeInTheDocument()
    expect(screen.getByText('Start blank')).toBeInTheDocument()
    expect(screen.getByText('Poll')).toBeInTheDocument()
    expect(screen.getByText('Anonymous')).toBeInTheDocument()
    expect(screen.queryByText('How do you want to build?')).not.toBeInTheDocument()
    expect(screen.queryByText('Quick Start')).not.toBeInTheDocument()
    expect(screen.queryByText('Full Studio')).not.toBeInTheDocument()
  })

  it('an artist is routed straight to Studio with no picker shown at all', () => {
    renderModal({ currentUser: { id: 'a1', role: 'artist' }, preselectedType: 'personal' })

    expect(navigateSpy).toHaveBeenCalledWith('/studio?type=personal', { state: { isNew: true } })
    expect(screen.queryByText('Start blank')).not.toBeInTheDocument()
  })

  it('a non-personal preselect (e.g. a Home format tile) skips straight to the simple editor', () => {
    renderModal({ preselectedType: 'poll' })

    expect(navigateSpy).toHaveBeenCalledWith('/quick?type=poll')
    expect(screen.queryByText('Start blank')).not.toBeInTheDocument()
  })

  it('"Start blank" goes straight to the simple editor with no template', () => {
    renderModal()

    fireEvent.click(screen.getByText('Start blank'))

    expect(navigateSpy).toHaveBeenCalledWith('/quick?type=personal')
  })

  it('a secondary type tile skips templates entirely', () => {
    renderModal()

    fireEvent.click(screen.getByText('Trivia'))

    expect(navigateSpy).toHaveBeenCalledWith('/quick?type=trivia')
  })

  it('picking an occasion shows only that occasion\'s free-to-use templates, then hands off the template id', () => {
    renderModal({
      marketplaceTemplates: [
        template({ id: 'bday-1', title: 'Birthday Balloons', category: 'birthday' }),
        template({ id: 'anniv-1', title: 'Anniversary Glow', category: 'anniversary' }),
      ],
    })

    fireEvent.click(screen.getByText('Birthday'))

    expect(screen.getByText('Birthday Balloons')).toBeInTheDocument()
    expect(screen.queryByText('Anniversary Glow')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Birthday Balloons'))
    expect(navigateSpy).toHaveBeenCalledWith('/quick?type=personal&template=bday-1')
  })

  it('shows a start-blank fallback when an occasion has no templates yet', () => {
    renderModal({ marketplaceTemplates: [] })

    fireEvent.click(screen.getByText('Sorry'))

    expect(screen.getByText(/No templates yet for Sorry/)).toBeInTheDocument()
  })

  it('a locked, priced template shows an unlock step instead of using it immediately', () => {
    renderModal({
      marketplaceTemplates: [template({ id: 'locked-1', title: 'Founder Card', price: 8, isUnlocked: false })],
    })

    fireEvent.click(screen.getByText('Birthday'))
    fireEvent.click(screen.getByText('Founder Card'))

    expect(screen.getByText('Unlock this template')).toBeInTheDocument()
    expect(navigateSpy).not.toHaveBeenCalledWith(expect.stringContaining('/quick'))
  })

  it('confirming an unlock calls unlockTemplateAction exactly once, then proceeds to the editor', async () => {
    const unlockTemplateAction = vi.fn().mockResolvedValue({ ok: true })
    renderModal({
      marketplaceTemplates: [template({ id: 'locked-1', title: 'Founder Card', price: 8, isUnlocked: false })],
      unlockTemplateAction,
    })

    fireEvent.click(screen.getByText('Birthday'))
    fireEvent.click(screen.getByText('Founder Card'))
    fireEvent.click(screen.getByRole('button', { name: /Unlock — 8 CC/i }))

    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/quick?type=personal&template=locked-1'))
    expect(unlockTemplateAction).toHaveBeenCalledTimes(1)
    expect(unlockTemplateAction).toHaveBeenCalledWith('locked-1')
  })

  it('a locked template prompts sign-in instead of unlocking when logged out', () => {
    const openAuthModal = vi.fn()
    const unlockTemplateAction = vi.fn()
    renderModal({
      currentUser: null,
      marketplaceTemplates: [template({ id: 'locked-1', title: 'Founder Card', price: 8, isUnlocked: false })],
      openAuthModal,
      unlockTemplateAction,
    })

    fireEvent.click(screen.getByText('Birthday'))
    fireEvent.click(screen.getByText('Founder Card'))

    expect(openAuthModal).toHaveBeenCalledTimes(1)
    expect(unlockTemplateAction).not.toHaveBeenCalled()
    expect(screen.queryByText('Unlock this template')).not.toBeInTheDocument()
  })
})
