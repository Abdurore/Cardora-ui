// Explore's fixed occasion filter — 6 tabs, same set a sender picks from
// when starting a card. Artist templates are published under a wider,
// free-form `category` string (see CardStudio's publish dropdown), so this
// maps each real category value down to one of the 6 tabs. `holiday` and
// `other` have no clean home in the 6-tab taxonomy and are deliberately left
// unmapped — those templates are only reachable via "All", not a named tab.
export const EXPLORE_OCCASION_TABS = [
  'Birthday',
  'Anniversary',
  'Sorry',
  'Congrats',
  'Thank you',
  'Just because',
]

const CATEGORY_TO_TAB = {
  birthday: 'Birthday',
  anniversary: 'Anniversary',
  apology: 'Sorry',
  sorry: 'Sorry',
  sympathy: 'Sorry',
  'get-well': 'Sorry',
  wedding: 'Congrats',
  proposal: 'Congrats',
  graduation: 'Congrats',
  celebration: 'Congrats',
  congratulations: 'Congrats',
  congrats: 'Congrats',
  'thank-you': 'Thank you',
  'thank you': 'Thank you',
  'just-because': 'Just because',
  'just because': 'Just because',
}

// Returns one of EXPLORE_OCCASION_TABS, or null if this category has no
// mapped tab (still visible under "All", just not filterable by name).
export function categoryToOccasionTab(category) {
  const key = String(category || '').trim().toLowerCase()
  return CATEGORY_TO_TAB[key] || null
}
