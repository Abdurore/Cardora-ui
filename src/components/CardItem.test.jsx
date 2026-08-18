import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CardItem from './CardItem.jsx'

// Explore/Marketplace consolidation: a template tile has exactly one of
// three unlock states -- free, priced-and-locked, or priced-and-owned --
// and "owned" must never regress back to showing a price (that would be a
// double-charge prompt).
describe('CardItem — unlock state badge', () => {
  it('shows "Use free" for a template priced at 0', () => {
    render(<CardItem id="t1" title="Free One" isTemplate price={0} isUnlocked />)
    expect(screen.getByText('Use free')).toBeInTheDocument()
  })

  it('shows the CC price for a priced, not-yet-unlocked template', () => {
    render(<CardItem id="t2" title="Priced One" isTemplate price={8} isUnlocked={false} />)
    expect(screen.getByText('8 CC')).toBeInTheDocument()
  })

  it('shows "Use" (never the price again) once a priced template is unlocked', () => {
    render(<CardItem id="t3" title="Owned One" isTemplate price={8} isUnlocked />)
    expect(screen.getByText('Use')).toBeInTheDocument()
    expect(screen.queryByText('8 CC')).not.toBeInTheDocument()
  })

  it('badges a Founding Artist template', () => {
    render(<CardItem id="t4" title="Founder Card" isTemplate artistName="Ada" isFoundingArtist />)
    expect(screen.getByText('★ Founding Artist')).toBeInTheDocument()
  })

  it('does not badge a non-Founding-Artist template', () => {
    render(<CardItem id="t5" title="Regular Card" isTemplate artistName="Bo" isFoundingArtist={false} />)
    expect(screen.queryByText('★ Founding Artist')).not.toBeInTheDocument()
  })
})
