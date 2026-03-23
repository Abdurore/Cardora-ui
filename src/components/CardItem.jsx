function CardItem({ title, meta, likes, tag, variant = 'one', onClick }) {
  return (
    <button type="button" className={`card ${variant}`} onClick={onClick}>
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
    </button>
  )
}

export default CardItem
