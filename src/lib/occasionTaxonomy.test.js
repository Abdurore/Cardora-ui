import { describe, it, expect } from 'vitest'
import { EXPLORE_OCCASION_TABS, categoryToOccasionTab } from './occasionTaxonomy.js'

describe('categoryToOccasionTab', () => {
  it('maps every real publish category to one of the 6 Explore tabs, or null', () => {
    expect(categoryToOccasionTab('birthday')).toBe('Birthday')
    expect(categoryToOccasionTab('anniversary')).toBe('Anniversary')
    expect(categoryToOccasionTab('apology')).toBe('Sorry')
    expect(categoryToOccasionTab('sympathy')).toBe('Sorry')
    expect(categoryToOccasionTab('get-well')).toBe('Sorry')
    expect(categoryToOccasionTab('wedding')).toBe('Congrats')
    expect(categoryToOccasionTab('proposal')).toBe('Congrats')
    expect(categoryToOccasionTab('graduation')).toBe('Congrats')
    expect(categoryToOccasionTab('celebration')).toBe('Congrats')
    expect(categoryToOccasionTab('congratulations')).toBe('Congrats')
    expect(categoryToOccasionTab('thank-you')).toBe('Thank you')
    expect(categoryToOccasionTab('just-because')).toBe('Just because')
    expect(categoryToOccasionTab('holiday')).toBeNull()
    expect(categoryToOccasionTab('other')).toBeNull()
    expect(categoryToOccasionTab('')).toBeNull()
    expect(categoryToOccasionTab(undefined)).toBeNull()
  })

  it('is case-insensitive', () => {
    expect(categoryToOccasionTab('BIRTHDAY')).toBe('Birthday')
    expect(categoryToOccasionTab('Just-Because')).toBe('Just because')
  })

  it('every mapped tab is a member of the fixed 6-tab list', () => {
    const categories = ['birthday', 'anniversary', 'apology', 'wedding', 'thank-you', 'just-because']
    for (const c of categories) {
      expect(EXPLORE_OCCASION_TABS).toContain(categoryToOccasionTab(c))
    }
  })
})
