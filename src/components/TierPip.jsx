// A small badge marking a studio control as a "premium touch" or "elite
// touch" — replaces the old padlock/dashed-border/grayscale treatment.
// Nothing it's attached to is ever disabled; picking it just raises the
// card's computed tier (see src/lib/tierRequirements.js).
function TierPip({ tier, compact = false }) {
  if (tier !== 'premium' && tier !== 'elite') return null
  const label = tier === 'elite' ? 'Elite' : 'Premium'
  return (
    <span
      className={`cs-tier-pip cs-tier-pip-${tier}${compact ? ' compact' : ''}`}
      title={`${label} touch — raises the card's send cost`}
    >
      {tier === 'elite' && <span className="cs-tier-pip-star">★</span>}
      {/* Compact premium had neither the star nor the label, so it rendered
          as an empty lozenge -- meaningless without the hover title (i.e.
          on every phone). */}
      {tier === 'premium' && compact && <span className="cs-tier-pip-star">◆</span>}
      {!compact && label}
    </span>
  )
}

export default TierPip
