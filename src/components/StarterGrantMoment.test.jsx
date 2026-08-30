import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import StarterGrantMoment from './StarterGrantMoment.jsx'

// 3.4: "Surface immediately after first signup as a moment, not a toast."
// MainLayout.jsx owns the once-ever localStorage gating and the
// hydrateSession() trigger -- this component just renders (or doesn't)
// based on the `amount` prop it's handed.

const navigateSpy = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => navigateSpy }
})

function renderMoment(amount, onDismiss = vi.fn()) {
  return render(
    <MemoryRouter>
      <StarterGrantMoment amount={amount} onDismiss={onDismiss} />
    </MemoryRouter>,
  )
}

describe('StarterGrantMoment', () => {
  afterEach(() => {
    navigateSpy.mockClear()
  })

  it('renders nothing when there is no amount', () => {
    renderMoment(null)
    expect(screen.queryByText(/CC/)).not.toBeInTheDocument()
  })

  it('shows the granted amount when present', () => {
    renderMoment(15)
    expect(screen.getByText('+15 CC')).toBeInTheDocument()
    expect(screen.getByText(/starting with 15 free Cardora Credits/)).toBeInTheDocument()
  })

  it('"Send your first card" dismisses and navigates to /create', () => {
    const onDismiss = vi.fn()
    renderMoment(15, onDismiss)

    fireEvent.click(screen.getByRole('button', { name: 'Send your first card' }))

    expect(onDismiss).toHaveBeenCalled()
    expect(navigateSpy).toHaveBeenCalledWith('/create')
  })

  it('"Maybe later" dismisses without navigating', () => {
    const onDismiss = vi.fn()
    renderMoment(15, onDismiss)

    fireEvent.click(screen.getByRole('button', { name: 'Maybe later' }))

    expect(onDismiss).toHaveBeenCalled()
    expect(navigateSpy).not.toHaveBeenCalled()
  })

  it('the close (×) button dismisses without navigating', () => {
    const onDismiss = vi.fn()
    renderMoment(15, onDismiss)

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(onDismiss).toHaveBeenCalled()
    expect(navigateSpy).not.toHaveBeenCalled()
  })

  it('clicking the backdrop dismisses', () => {
    const onDismiss = vi.fn()
    const { container } = renderMoment(15, onDismiss)

    fireEvent.click(container.querySelector('.sgm-backdrop'))

    expect(onDismiss).toHaveBeenCalled()
  })
})
