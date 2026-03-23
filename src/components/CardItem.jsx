function CardItem({
  id,
  title,
  meta,
  likes,
  tag,
  variant = 'one',
  onClick,
  isFavorite,
  onToggleFavorite,
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={`card ${variant}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onClick?.()
      }}
    >
      <button
        type="button"
        className={`card-favorite ${isFavorite ? 'active' : ''}`}
        aria-pressed={isFavorite}
        onClick={(event) => {
          event.stopPropagation()
          onToggleFavorite?.(id)
        }}
      >
        ❤
      </button>
      {tag ? <span className={`badge ${tag.toLowerCase()}`}>{tag}</span> : null}
      <div className="card-thumb" />
      <div className="card-info">
        <h4>{title}</h4>
        <div className="card-meta">
          <span>{meta}</span>
          <span className="dot" />
          <span>{likes}</span>
        </div>
      </div>
    </div>
  )
}

export default CardItem
