function CardExperience({ data, onClose }) {
  return (
    <section
      className="experience"
      style={{ '--experience-bg': data.theme.background, '--accent': data.accents.primary }}
    >
      <div className="experience-overlay" style={{ background: data.theme.overlay }} />
      <div className="experience-emojis">
        {['💗', '✨', '💌', '💖', '🌟', '💫'].map((emoji, index) => (
          <span key={`${emoji}-${index}`} className={`emoji e${index + 1}`}>
            {emoji}
          </span>
        ))}
      </div>

      <div className="experience-card" style={{ animation: data.motion.entrance }}>
        <header className="experience-header">
          <div>
            <p className="experience-label">{data.content.header}</p>
            <p className="experience-preview">{data.content.preview}</p>
          </div>
          <button type="button" className="experience-close" onClick={onClose}>
            Close
          </button>
        </header>

        <button className="experience-open" type="button">
          {data.content.openCta}
        </button>

        <div className="experience-opened">
          <div className="experience-shell">
            <div className="experience-border" style={{ background: data.theme.border }} />
            <div className="experience-body">
              <h3 style={{ fontFamily: data.typography.title }}>{data.content.title}</h3>
              <p>{data.content.message}</p>
              <div className="experience-image" />
              <button className="read-more" type="button">
                Read more
              </button>
              <p className="experience-extra">{data.content.extra}</p>
            </div>
          </div>
        </div>

        <div className="experience-question">
          <p>{data.content.question}</p>
          <div className="question-actions">
            <button className="yes" type="button">
              {data.content.yes}
            </button>
            <button className="no" type="button">
              {data.content.no}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default CardExperience
