import { useNavigate } from 'react-router-dom'

function NotFound() {
  const navigate = useNavigate()

  return (
    <main className="notfound-page">
      <div className="notfound-card">
        <img src="/cardora-logo.png?v=4" alt="" className="notfound-logo" />
        <p className="notfound-kicker">404</p>
        <h1>This card has gone quiet</h1>
        <p>
          The link may have expired, been deleted, or never existed. Some surprises are meant to vanish.
        </p>
        <div className="notfound-actions">
          <button type="button" className="primary" onClick={() => navigate('/create')}>
            Create a card
          </button>
          <button type="button" className="ghost" onClick={() => navigate('/')}>
            Back home
          </button>
        </div>
      </div>
    </main>
  )
}

export default NotFound
