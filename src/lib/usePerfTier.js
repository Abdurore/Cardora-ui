import { useSyncExternalStore } from 'react'
import { getPerfTier, subscribePerfTier } from './perfTier.js'

// Re-renders when the tier changes (a runtime downgrade, or the user changing
// the Effects setting), so components can swap to a lighter configuration.
export function usePerfTier() {
  return useSyncExternalStore(subscribePerfTier, getPerfTier, () => 'high')
}
