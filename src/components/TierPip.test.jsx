import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import TierPip from './TierPip.jsx'

describe('TierPip', () => {
  it('renders nothing for classic', () => {
    const { container } = render(<TierPip tier="classic" />)
    expect(container.firstChild).toBeNull()
  })

  it.each(['premium', 'elite'])('a compact %s pip is never an empty badge', (tier) => {
    const { container } = render(<TierPip tier={tier} compact />)
    expect(container.textContent.trim()).not.toBe('')
  })

  it('full-size pips carry their label', () => {
    const { container } = render(<TierPip tier="premium" />)
    expect(container.textContent).toContain('Premium')
  })
})
