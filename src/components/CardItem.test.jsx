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

// 7.9: "My Cards" thumbnails were a purely decorative blurred gradient,
// keyed only to card type -- unrelated to the sender's own theme or an
// uploaded photo. A photo (previewImage) still wins; otherwise the
// thumbnail now uses the card's own chosen colors instead of the generic
// fallback.
describe('CardItem — 7.9 real thumbnail previews', () => {
  it('renders the real photo when previewImage is provided', () => {
    render(<CardItem id="c1" title="Card" previewImage="https://cdn.example.com/photo.jpg" />)
    const img = screen.getByRole('img', { name: 'Card' })
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/photo.jpg')
  })

  it('uses the card\'s own gradient colors for the thumbnail background when there is no photo', () => {
    const { container } = render(
      <CardItem id="c2" title="Card" previewColors={{ background: '#111111', accent: '#7ef7ff', gradient: ['#ff9bd2', '#111111'] }} />,
    )
    const thumb = container.querySelector('.card-thumb')
    // jsdom normalizes hex to rgb() in the computed inline style string.
    expect(thumb.style.background).toContain('rgb(255, 155, 210)')
    expect(thumb.style.background).toContain('rgb(17, 17, 17)')
  })

  it('a photo takes priority over previewColors when both are present', () => {
    const { container } = render(
      <CardItem
        id="c3"
        title="Card"
        previewImage="https://cdn.example.com/photo.jpg"
        previewColors={{ background: '#111111', accent: '#7ef7ff', gradient: ['#ff9bd2', '#111111'] }}
      />,
    )
    const thumb = container.querySelector('.card-thumb')
    expect(thumb.style.background).toBe('')
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('falls back to the generic decorative gradient (no inline style) when neither a photo nor colors are known', () => {
    const { container } = render(<CardItem id="c4" title="Card" />)
    const thumb = container.querySelector('.card-thumb')
    expect(thumb.style.background).toBe('')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
